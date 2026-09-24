// Executes unchanged source function bodies with mocked hardware/network dependencies.
// Tests control flow, NOT React/browser/phone latency. Run: node <this file>
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'frontend/node_modules/typescript'));
const source = fs.readFileSync(path.join(root, 'frontend/src/app/camera/page.tsx'), 'utf8');
const ast = ts.createSourceFile('camera.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect, queue;
function walk(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('getUserMedia')) effect = node.arguments[0].getText(ast);
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'processNextInQueue') queue = node.initializer.getText(ast);
  ts.forEachChild(node, walk);
}
walk(ast);
assert(effect && queue);
const compile = text => ts.transpileModule(text, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const settle = async () => { for (let i=0;i<20;i++) await Promise.resolve(); };

(async () => {
  const results = [];
  for (const initiallyMounted of [false, true]) {
    const stream = {getTracks:()=>[{stop(){}}]};
    const video = {srcObject:null, play:()=>Promise.resolve()};
    let ready = false;
    const context = vm.createContext({videoRef:{current:initiallyMounted ? video : null},streamRef:{current:null},navigator:{mediaDevices:{getUserMedia:()=>Promise.resolve(stream)}},facingMode:'environment',resetTimerRef:{current:null},clearTimeout(){},setCameraError(){},setIsCameraReady(v){ready=v;},console});
    vm.runInContext(compile(`globalThis.cleanup = (${effect})();`), context);
    await settle();
    if (!initiallyMounted) context.videoRef.current = video;
    if (video.onloadedmetadata) video.onloadedmetadata();
    assert.equal(video.srcObject === stream, initiallyMounted);
    assert.equal(ready, initiallyMounted);
    results.push({scenario:initiallyMounted?'video mounted before stream resolves':'stream resolves before conditional video mount',attached:video.srcObject===stream,ready});
    context.cleanup();
  }
  let releaseUpload;
  const calls = [];
  const context = vm.createContext({queueRef:{current:[{id:'one',blob:{},width:1920,height:1080},{id:'two',blob:{},width:1920,height:1080}]},isProcessingQueueRef:{current:false},spaceId:'audit-space',spaceRef:{current:{name:'Audit'}},resetTimerRef:{current:null},setStatusType(){},setStatusMessage(){},setPendingUploads(){},setRecentCaptureCount(){},setTimeout(){},clearTimeout(){},console:{error(){}},apiRequest:async endpoint=>{calls.push(endpoint);return {};},uploadDirectToCloudinary:()=>{calls.push('upload');return new Promise(resolve=>{releaseUpload=()=>resolve({public_id:'audit',secure_url:'https://example.invalid',width:1920,height:1080});});}});
  vm.runInContext(compile(`const processNextInQueue = ${queue}; globalThis.run = processNextInQueue;`), context);
  const first = context.run();
  await settle();
  assert.deepEqual(calls, ['/media/cloudinary-sign','upload']);
  assert.equal(context.queueRef.current.length,1);
  releaseUpload();
  await first;
  await settle();
  assert.deepEqual(calls, ['/media/cloudinary-sign','upload','/memories','/media/cloudinary-sign','upload']);
  releaseUpload();
  await settle();
  results.push({scenario:'two queued captures',calls:[...calls],second_signature_waits_for_first_memory:true});
  context.queueRef.current.push({id:'failed',blob:{}});
  context.uploadDirectToCloudinary = async ()=>{throw new Error('simulated offline');};
  await context.run();
  assert.equal(context.queueRef.current.length,0);
  assert.equal(context.isProcessingQueueRef.current,false);
  results.push({scenario:'upload rejects',remaining_queue_length:0,failed_item_requeued:false});
  console.log(JSON.stringify({scope:'Exact source bodies; simulated dependency timing, no hardware or network measurements',results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
