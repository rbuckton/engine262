import { BooleanValue, NullValue, ObjectValue, Value, type StringValue, type PropertyKeyValue } from './value.mjs';
import {
  EnsureCompletion,
  NormalCompletion,
  ThrowCompletion,
  Q, X, Completion,
} from './completion.mjs';
import {
  IsCallable,
  Call, Construct, Assert,
  GetActiveScriptOrModule,
  CleanupFinalizationRegistry,
  CreateArrayFromList,
  FinishLoadingImportedModule,
  Realm,
  type ECMAScriptFunctionObjectValue,
  type ArgumentList,
  type FunctionObjectValue,
  GraphLoadingState,
  PromiseCapabilityRecord,
  type Intrinsic,
  type Intrinsics,
} from './abstract-ops/all.mjs';
import { GlobalDeclarationInstantiation } from './runtime-semantics/all.mjs';
import { Evaluation, type StatementEvaluator } from './evaluator.mjs';
import { CallSite, unwind, type Mutable } from './helpers.mjs';
import { AbstractModuleRecord, CyclicModuleRecord, EnvironmentRecord, PrivateEnvironmentRecord, runJobQueue, type ScriptRecord } from './api.mjs';
import * as messages from './messages.mjs';
import type { PromiseObjectValue } from './intrinsics/Promise.mjs';
import type { ParseNode } from './parser/ParseNode.mjs';

export const FEATURES = [
  {
    name: 'FinalizationRegistry.prototype.cleanupSome',
    flag: 'cleanup-some',
    url: 'https://github.com/tc39/proposal-cleanup-some',
  },
  {
    name: 'Well-Formed Unicode Strings',
    flag: 'is-usv-string',
    url: 'https://github.com/tc39/proposal-is-usv-string',
  },
] as const;
FEATURES.forEach(Object.freeze);
Object.freeze(FEATURES);

export type FeatureFlag = typeof FEATURES[number]['flag'];

class ExecutionContextStack extends Array<ExecutionContext> {
  // This ensures that only the length taking overload is supported.
  // This is necessary to support `ArraySpeciesCreate`, which invokes
  // the constructor with argument `length`:
  constructor(length = 0) {
    super(+length);
  }

  override pop(ctx: ExecutionContext): ExecutionContext | undefined;
  override pop(): never;
  override pop(ctx?: ExecutionContext) {
    if (!ctx) throw new TypeError();
    if (!ctx.poppedForTailCall) {
      const popped = super.pop();
      Assert(popped === ctx);
      return popped;
    }
    return undefined;
  }
}

export interface CommonHostDefinedOptions {
  public?: unknown;
  ensureCanCompileStrings?: (callerRealm: Realm, calleeRealm: Realm) => void;
  promiseRejectionTracker?: (promise: PromiseObjectValue, operation: 'reject' | 'handle') => NormalCompletion<unknown> | void;
  hasSourceTextAvailable?: (func: FunctionObjectValue & { SourceText: string }) => Completion<BooleanValue> | BooleanValue;
  loadImportedModule?: (referrer: ScriptRecord | CyclicModuleRecord | Realm, specifier: string, hostDefined: ResolvedHostDefinedOptions | undefined, cb: (result: Value | Completion<Value>) => void) => void;
  getImportMetaProperties?: (public_: unknown) => { Key: PropertyKeyValue, Value: Value }[] | NormalCompletion<{ Key: PropertyKeyValue, Value: Value }[]>;
  finalizeImportMeta?: (importMeta: ObjectValue, public_: unknown) => void | Completion<void>;
  cleanupFinalizationRegistry?: (fg: ObjectValue) => void | Completion<void>;
  onNodeEvaluation?: (node: ParseNode, realm: Realm) => void | Completion<void>;
  onDebugger?: () => void | Completion<void>;
  boost?: {
    evaluateScript?: (script: ScriptRecord) => Completion;
    callFunction?: (this: ECMAScriptFunctionObjectValue, thisArgument: Value, argumentsList: ArgumentList) => Value | NormalCompletion<Value> | ThrowCompletion;
    constructFunction?: (this: ECMAScriptFunctionObjectValue, argumentsList: ArgumentList, newTarget: ObjectValue) => ObjectValue | NormalCompletion<ObjectValue> | ThrowCompletion;
    evaluatePattern?: unknown;
  };
}

export interface HostDefinedOptions extends CommonHostDefinedOptions {
  [key: string]: unknown;
  features?: FeatureFlag[];
}

export interface ResolvedHostDefinedOptions extends Readonly<Omit<CommonHostDefinedOptions, 'features'>> {
  readonly boost?: Readonly<CommonHostDefinedOptions['boost']>;
  readonly features: { readonly [P in FeatureFlag]: boolean };
}

interface JobQueueItem {
  queueName: string;
  job: () => Completion | void;
  callerRealm: Realm;
  callerScriptOrModule: unknown;
}

let agentSignifier = 0;
/** https://tc39.es/ecma262/#sec-agents */
export class Agent {
  AgentRecord;
  // #execution-context-stack
  executionContextStack = new ExecutionContextStack();
  // NON-SPEC
  jobQueue: JobQueueItem[] = [];
  scheduledForCleanup = new Set();
  hostDefinedOptions: ResolvedHostDefinedOptions;
  constructor(options: HostDefinedOptions = {}) {
    // #table-agent-record
    const Signifier = agentSignifier;
    agentSignifier += 1;
    this.AgentRecord = {
      LittleEndian: Value.true,
      CanBlock: Value.true,
      Signifier,
      IsLockFree1: Value.true,
      IsLockFree2: Value.true,
      CandidateExecution: undefined,
      KeptAlive: new Set(),
    };

    this.hostDefinedOptions = {
      ...options,
      features: FEATURES.reduce((acc, { flag }) => {
        if (options.features) {
          acc[flag] = options.features.includes(flag);
        } else {
          acc[flag] = false;
        }
        return acc;
      }, {} as Mutable<ResolvedHostDefinedOptions['features']>),
    };
  }

  // #running-execution-context
  get runningExecutionContext() {
    return this.executionContextStack[this.executionContextStack.length - 1];
  }

  // #current-realm
  get currentRealmRecord() {
    return this.runningExecutionContext.Realm;
  }

  // #active-function-object
  get activeFunctionObject() {
    return this.runningExecutionContext.Function;
  }

  // Get an intrinsic by name for the current realm
  intrinsic<K extends Intrinsic>(name: K) {
    return this.currentRealmRecord.Intrinsics[name] as Intrinsics[K]['Type']; // NOTE: unsound cast
  }

  // Generate a throw completion using message templates
  Throw<K extends keyof typeof messages>(type: string | Value, template: K, ...templateArgs: Parameters<typeof messages[K]>): ThrowCompletion {
    if (type instanceof Value) {
      return ThrowCompletion(type);
    }
    const messageFunc = (messages[template] as (...args: Parameters<typeof messages[K]>) => string);
    const message = messageFunc(...templateArgs);
    const cons = this.currentRealmRecord.Intrinsics[`%${type}%`];
    let error;
    if (type === 'AggregateError') {
      error = X(Construct(cons, [
        X(CreateArrayFromList([])),
        Value(message),
      ]));
    } else {
      error = X(Construct(cons, [Value(message)]));
    }
    return ThrowCompletion(error);
  }

  queueJob(queueName: string, job: () => Completion | void) {
    const callerContext = this.runningExecutionContext;
    const callerRealm = callerContext.Realm;
    const callerScriptOrModule = GetActiveScriptOrModule();
    const pending = {
      queueName,
      job,
      callerRealm,
      callerScriptOrModule,
    };
    this.jobQueue.push(pending);
  }

  // NON-SPEC: Check if a feature is enabled in this agent.
  feature(name: FeatureFlag) {
    return this.hostDefinedOptions.features[name];
  }

  // NON-SPEC
  mark(m: GCMarker) {
    this.AgentRecord.KeptAlive.forEach((v) => {
      m(v);
    });
    this.executionContextStack.forEach((e) => {
      m(e);
    });
    this.jobQueue.forEach((j) => {
      m(j.callerRealm);
      m(j.callerScriptOrModule);
    });
  }
}

export let surroundingAgent!: Agent; // NOTE: unsound definite assignment operator (`!`)
export function setSurroundingAgent(a: Agent) {
  surroundingAgent = a;
}

/** https://tc39.es/ecma262/#sec-execution-contexts */
export class ExecutionContext {
  codeEvaluationState!: StatementEvaluator | null; // NOTE: unsound definite assignment operator (`!`)
  Function!: FunctionObjectValue | NullValue; // NOTE: unsound definite assignment operator (`!`)
  Realm!: Realm; // NOTE: unsound definite assignment operator (`!`)
  ScriptOrModule!: ScriptRecord | AbstractModuleRecord | NullValue; // NOTE: unsound definite assignment operator (`!`)
  VariableEnvironment!: EnvironmentRecord; // NOTE: unsound definite assignment operator (`!`)
  LexicalEnvironment!: EnvironmentRecord; // NOTE: unsound definite assignment operator (`!`)
  PrivateEnvironment!: PrivateEnvironmentRecord | NullValue; // NOTE: unsound definite assignment operator (`!`)
  // NON-SPEC
  callSite = new CallSite(this);
  promiseCapability!: PromiseCapabilityRecord; // NOTE: unsound definite assignment operator (`!`)
  poppedForTailCall = false;
  HostDefined: unknown;

  copy() {
    const e = new ExecutionContext();
    e.codeEvaluationState = this.codeEvaluationState;
    e.Function = this.Function;
    e.Realm = this.Realm;
    e.ScriptOrModule = this.ScriptOrModule;
    e.VariableEnvironment = this.VariableEnvironment;
    e.LexicalEnvironment = this.LexicalEnvironment;
    e.PrivateEnvironment = this.PrivateEnvironment;

    e.callSite = this.callSite.clone(e);
    e.promiseCapability = this.promiseCapability;
    return e;
  }

  // NON-SPEC
  mark(m: GCMarker) {
    m(this.Function);
    m(this.Realm);
    m(this.ScriptOrModule);
    m(this.VariableEnvironment);
    m(this.LexicalEnvironment);
    m(this.PrivateEnvironment);
    m(this.promiseCapability);
  }
}

/** https://tc39.es/ecma262/#sec-runtime-semantics-scriptevaluation */
export function ScriptEvaluation(scriptRecord: ScriptRecord) {
  if (surroundingAgent.hostDefinedOptions.boost?.evaluateScript) {
    return surroundingAgent.hostDefinedOptions.boost.evaluateScript(scriptRecord);
  }

  const globalEnv = scriptRecord.Realm.GlobalEnv;
  const scriptContext = new ExecutionContext();
  scriptContext.Function = Value.null;
  scriptContext.Realm = scriptRecord.Realm;
  scriptContext.ScriptOrModule = scriptRecord;
  scriptContext.VariableEnvironment = globalEnv;
  scriptContext.LexicalEnvironment = globalEnv;
  scriptContext.PrivateEnvironment = Value.null;
  scriptContext.HostDefined = scriptRecord.HostDefined;
  // Suspend runningExecutionContext
  surroundingAgent.executionContextStack.push(scriptContext);
  const scriptBody = scriptRecord.ECMAScriptCode;
  let result: Completion = EnsureCompletion(GlobalDeclarationInstantiation(scriptBody, globalEnv));

  if (result.Type === 'normal') {
    result = EnsureCompletion(unwind(Evaluation(scriptBody)));
  }

  if (result.Type === 'normal' && !result.Value) {
    result = NormalCompletion(Value.undefined);
  }

  // Suspend scriptCtx
  surroundingAgent.executionContextStack.pop(scriptContext);
  // Resume(surroundingAgent.runningExecutionContext);

  return result;
}

/** https://tc39.es/ecma262/#sec-hostenqueuepromisejob */
export function HostEnqueuePromiseJob(job: () => Completion | void, _realm: Realm | NullValue) {
  surroundingAgent.queueJob('PromiseJobs', job);
}

/** https://tc39.es/ecma262/#sec-agentsignifier */
export function AgentSignifier() {
  // 1. Let AR be the Agent Record of the surrounding agent.
  const AR = surroundingAgent.AgentRecord;
  // 2. Return AR.[[Signifier]].
  return AR.Signifier;
}

/** https://tc39.es/ecma262/#sec-hostensurecancompilestrings */
export function HostEnsureCanCompileStrings(callerRealm: Realm, calleeRealm: Realm) {
  if (surroundingAgent.hostDefinedOptions.ensureCanCompileStrings !== undefined) {
    Q(surroundingAgent.hostDefinedOptions.ensureCanCompileStrings(callerRealm, calleeRealm));
  }
  return NormalCompletion(undefined);
}

/** https://tc39.es/ecma262/#sec-host-promise-rejection-tracker */
export function HostPromiseRejectionTracker(promise: PromiseObjectValue, operation: 'reject' | 'handle') {
  const realm = surroundingAgent.currentRealmRecord;
  if (realm && realm.HostDefined.promiseRejectionTracker) {
    X(realm.HostDefined.promiseRejectionTracker(promise, operation));
  }
}

/** https://tc39.es/ecma262/#sec-hosthassourcetextavailable */
export function HostHasSourceTextAvailable(func: FunctionObjectValue & { SourceText: string }) {
  if (surroundingAgent.hostDefinedOptions.hasSourceTextAvailable) {
    return X(surroundingAgent.hostDefinedOptions.hasSourceTextAvailable(func));
  }
  return Value.true;
}

/** https://tc39.es/ecma262/#sec-HostLoadImportedModule */
export function HostLoadImportedModule(referrer: ScriptRecord | CyclicModuleRecord | Realm, specifier: StringValue, hostDefined: ResolvedHostDefinedOptions | undefined, payload: GraphLoadingState | PromiseCapabilityRecord) {
  if (surroundingAgent.hostDefinedOptions.loadImportedModule) {
    const executionContext = surroundingAgent.runningExecutionContext;
    let result: Completion<Value> | undefined;
    let sync = true;
    surroundingAgent.hostDefinedOptions.loadImportedModule(referrer, specifier.stringValue(), hostDefined, (res) => {
      result = EnsureCompletion(res);
      if (!sync) {
        // If this callback has been called asynchronously, restore the correct execution context and enqueue a job.
        surroundingAgent.executionContextStack.push(executionContext);
        surroundingAgent.queueJob('FinishLoadingImportedModule', () => {
          FinishLoadingImportedModule(referrer, specifier, result, payload);
        });
        surroundingAgent.executionContextStack.pop(executionContext);
        runJobQueue();
      }
    });
    sync = false;
    if (result !== undefined) {
      FinishLoadingImportedModule(referrer, specifier, result, payload);
    }
  } else {
    FinishLoadingImportedModule(referrer, specifier, surroundingAgent.Throw('Error', 'CouldNotResolveModule', specifier), payload);
  }
}

/** https://tc39.es/ecma262/#sec-hostgetimportmetaproperties */
export function HostGetImportMetaProperties(moduleRecord: AbstractModuleRecord) {
  const realm = surroundingAgent.currentRealmRecord;
  if (realm.HostDefined.getImportMetaProperties) {
    return X(realm.HostDefined.getImportMetaProperties(moduleRecord.HostDefined!.public)); // TODO: unsound non-null assertion
  }
  return [];
}

/** https://tc39.es/ecma262/#sec-hostfinalizeimportmeta */
export function HostFinalizeImportMeta(importMeta: ObjectValue, moduleRecord: AbstractModuleRecord) {
  const realm = surroundingAgent.currentRealmRecord;
  if (realm.HostDefined.finalizeImportMeta) {
    return X(realm.HostDefined.finalizeImportMeta(importMeta, moduleRecord.HostDefined!.public)); // TODO: unsound non-null assertion
  }
  return Value.undefined;
}

/** https://tc39.es/ecma262/#sec-host-cleanup-finalization-registry */
export function HostEnqueueFinalizationRegistryCleanupJob(fg: ObjectValue) {
  if (surroundingAgent.hostDefinedOptions.cleanupFinalizationRegistry !== undefined) {
    Q(surroundingAgent.hostDefinedOptions.cleanupFinalizationRegistry(fg));
  } else {
    if (!surroundingAgent.scheduledForCleanup.has(fg)) {
      surroundingAgent.scheduledForCleanup.add(fg);
      surroundingAgent.queueJob('FinalizationCleanup', () => {
        surroundingAgent.scheduledForCleanup.delete(fg);
        CleanupFinalizationRegistry(fg);
      });
    }
  }
  return NormalCompletion(undefined);
}

/** https://tc39.es/ecma262/#sec-jobcallback-records */
export interface JobCallbackRecord {
  Callback: FunctionObjectValue;
  HostDefined: unknown;
}

/** https://tc39.es/ecma262/#sec-hostmakejobcallback */
export function HostMakeJobCallback(callback: FunctionObjectValue): JobCallbackRecord {
  // 1. Assert: IsCallable(callback) is true.
  Assert(IsCallable(callback) === Value.true);
  // 2. Return the JobCallback Record { [[Callback]]: callback, [[HostDefined]]: empty }.
  return { Callback: callback, HostDefined: undefined };
}

/** https://tc39.es/ecma262/#sec-hostcalljobcallback */
export function HostCallJobCallback(jobCallback: JobCallbackRecord, V: Value, argumentsList: ArgumentList) {
  // 1. Assert: IsCallable(jobCallback.[[Callback]]) is true.
  Assert(IsCallable(jobCallback.Callback) === Value.true);
  // 1. Return ? Call(jobCallback.[[Callback]], V, argumentsList).
  return Q(Call(jobCallback.Callback, V, argumentsList));
}

export type GCMarker = (value: unknown) => void;
