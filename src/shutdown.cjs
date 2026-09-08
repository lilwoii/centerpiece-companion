// Repeated quit requests must wait for the same cleanup, never bypass it.
function shutdownGate(cleanup, finish, failed){
 let complete=false, pending;
 return event=>{
  if(complete)return;
  event.preventDefault();
  if(pending)return pending;
  pending=Promise.resolve().then(cleanup).then(()=>{complete=true;finish();},error=>{pending=null;failed(error);});
  return pending;
 };
}
module.exports={shutdownGate};
