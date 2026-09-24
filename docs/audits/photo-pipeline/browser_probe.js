/* AUDIT ONLY. Paste into DevTools on a Space page BEFORE navigating to camera.
 * One shutter per run; wait for create, return to Space, wait for image load.
 * Export JSON.stringify(window.omluPhotoAudit.records, null, 2), then stop().
 * No uploads initiated, no credentials/pixels/URLs recorded, no persistence.
 * Reload also removes instrumentation. Never import this into the application.
 * Wrappers add measurement overhead. First-image timing is a candidate, not
 * proof that the newly created Drop painted; correlate with a DevTools trace.
 */
(() => {
  if (window.omluPhotoAudit) throw new Error('Stop/remove previous probe first');
  const records = [], restores = [], observers = [];
  const now = () => performance.now();
  const log = (stage, data = {}) => records.push({stage, at_ms: now(), ...data});
  let shutterAt = null, createdAt = null, canvasDoneAt = null;
  const wrap = (object, name, build) => {
    const original = object[name];
    const replacement = build(original);
    object[name] = replacement;
    restores.push(() => { if (object[name] === replacement) object[name] = original; });
  };
  const select = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k,obj[k]]));
  const settingsKeys = ['width','height','aspectRatio','frameRate','facingMode','resizeMode','focusMode','exposureMode','whiteBalanceMode'];
  if (navigator.mediaDevices?.getUserMedia) wrap(navigator.mediaDevices, 'getUserMedia', original => async function(constraints) {
    const start = now();
    log('camera_request', {video_constraints: typeof constraints.video === 'object' ? select(constraints.video,settingsKeys) : constraints.video});
    try {
      const stream = await original.call(this, constraints);
      const track = stream.getVideoTracks()[0];
      log('camera_stream_ready',{ms:now()-start,settings:track ? select(track.getSettings(),settingsKeys):{},capabilities:track?.getCapabilities ? select(track.getCapabilities(),settingsKeys):{}});
      return stream;
    } catch (error) { log('camera_error',{ms:now()-start,name:error.name}); throw error; }
  });
  const click = e => {
    if (!e.target.closest?.('button[aria-label="Capture Moment"]')) return;
    shutterAt = now(); createdAt = null; canvasDoneAt = null;
    log('shutter_click');
    requestAnimationFrame(() => requestAnimationFrame(() => log('shutter_next_frame_opportunity',{ms:now()-shutterAt})));
  };
  document.addEventListener('click',click,true);
  restores.push(()=>document.removeEventListener('click',click,true));
  const metadata = e => {
    if (!(e.target instanceof HTMLVideoElement)) return;
    const video = e.target;
    log('video_metadata',{width:video.videoWidth,height:video.videoHeight,readyState:video.readyState,dpr:devicePixelRatio});
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(()=>log('first_presented_video_frame'));
  };
  document.addEventListener('loadedmetadata',metadata,true);
  restores.push(()=>document.removeEventListener('loadedmetadata',metadata,true));
  wrap(CanvasRenderingContext2D.prototype,'drawImage', original=>function(source,...args) {
    const start=now();
    try { return original.call(this,source,...args); }
    finally {
      if (source instanceof HTMLVideoElement) log('capture_draw',{ms:now()-start,source_width:source.videoWidth,source_height:source.videoHeight,canvas_width:this.canvas.width,canvas_height:this.canvas.height,shutter_ms:shutterAt===null?null:now()-shutterAt});
    }
  });
  wrap(HTMLCanvasElement.prototype,'toBlob',original=>function(callback,type,quality) {
    const start=now(), width=this.width,height=this.height;
    return original.call(this,blob=>{
      canvasDoneAt=now();
      log('compression_blob_ready',{ms:now()-start,shutter_ms:shutterAt===null?null:now()-shutterAt,width,height,requested_format:type,actual_format:blob?.type,quality,encoded_bytes:blob?.size ?? null});
      callback(blob);
    },type,quality);
  });
  const apiStage = input => {
    const url = new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
    const p=url.pathname;
    if (p.endsWith('/media/cloudinary-sign')) return 'signature';
    if (p.endsWith('/memories')) return 'memory_create';
    if (/\/memories\/(space\/[^/]+|feed)$/.test(p)) return 'feed';
    if (/\/spaces\/[^/]+\/members$/.test(p)) return 'members';
    if (/\/spaces\/[^/]+$/.test(p)) return 'space';
    return null;
  };
  wrap(window,'fetch',original=>async function(input,init) {
    const stage=apiStage(input);
    if (!stage) return original.call(this,input,init);
    const start=now();
    if(stage==='signature') log('queue_wait',{ms:canvasDoneAt===null?null:start-canvasDoneAt});
    try {
      const response=await original.call(this,input,init);
      log(stage+'_headers',{ms:now()-start,status:response.status});
      // Time the actual caller's JSON read; do not clone/download body twice.
      const json=response.json.bind(response);
      response.json=async()=>{
        try { return await json(); }
        finally {
          log(stage+'_body',{ms:now()-start,status:response.status,shutter_ms:shutterAt===null?null:now()-shutterAt});
          if(stage==='memory_create' && response.ok) createdAt=now();
        }
      };
      return response;
    } catch(error) { log(stage+'_error',{ms:now()-start,name:error.name}); throw error; }
  });
  const xhrMeta=new WeakMap();
  wrap(XMLHttpRequest.prototype,'open',original=>function(method,url,...rest){
    const parsed=new URL(url,location.href);
    xhrMeta.set(this,{cloudinary:parsed.hostname==='api.cloudinary.com' && parsed.pathname.endsWith('/image/upload')});
    return original.call(this,method,url,...rest);
  });
  wrap(XMLHttpRequest.prototype,'send',original=>function(body){
    if(xhrMeta.get(this)?.cloudinary) {
      const start=now(), file=body instanceof FormData?body.get('file'):null;
      log('upload_start',{file_bytes:file instanceof Blob?file.size:null,format:file instanceof Blob?file.type:null});
      const progress=e=>log('upload_progress',{ms:now()-start,loaded:e.loaded,total:e.lengthComputable?e.total:null});
      this.upload.addEventListener('progress',progress);
      this.addEventListener('loadend',()=>{
        log('upload_end',{ms:now()-start,status:this.status});
        this.upload.removeEventListener('progress',progress);
        if(this.status>=200 && this.status<300) {
          try { log('uploaded_asset',select(JSON.parse(this.responseText),['width','height','bytes','format'])); } catch {}
        }
      },{once:true});
    }
    return original.call(this,body);
  });
  const imageLoad=e=>{
    if(!(e.target instanceof HTMLImageElement) || shutterAt===null || createdAt===null) return;
    if(!e.target.currentSrc.includes('/image/upload/')) return;
    log('cloudinary_image_loaded_candidate',{shutter_ms:now()-shutterAt,after_create_ms:now()-createdAt,width:e.target.naturalWidth,height:e.target.naturalHeight});
  };
  document.addEventListener('load',imageLoad,true);
  restores.push(()=>document.removeEventListener('load',imageLoad,true));
  try {
    const observer=new PerformanceObserver(list=>list.getEntries().forEach(e=>log('long_task',{start_ms:e.startTime,ms:e.duration})));
    observer.observe({type:'longtask',buffered:false});observers.push(observer);
  } catch {}
  window.omluPhotoAudit={records,stop(){restores.reverse().forEach(f=>f());observers.forEach(o=>o.disconnect());delete window.omluPhotoAudit;return records;}};
  log('probe_installed',{note:'single capture; timings include diagnostic overhead'});
})();
