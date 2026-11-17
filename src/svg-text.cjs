// Keep valid Unicode, tabs and line breaks; XML 1.0 excludes these code points.
// Apply only at rendering boundaries, never to the user's saved text or metadata.
function escape(value){return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
module.exports={escape};
