/* Session-gated entry for the protected Repository Observatory. */
(function installPlatformRepositoryEntry(){
"use strict";
function install(){const signed=document.getElementById("signed-in");if(!signed||document.getElementById("platform-repository-entry"))return;const card=document.createElement("div");card.id="platform-repository-entry";card.hidden=true;card.style.cssText="margin-bottom:18px;padding:14px;border:1px solid var(--rule-2);border-radius:12px;background:rgba(114,200,208,.035)";card.innerHTML='<strong style="display:block;margin-bottom:7px">Repository Observatory</strong><p style="margin:0 0 12px;color:var(--ink-3);line-height:1.55">Resolve an exact public GitHub, GitLab, or Bitbucket revision and preview an Idol scaffold. No provider credential or repository write.</p><a class="button primary" href="/repo">Open repository workbench</a>';signed.prepend(card);const render=()=>{card.hidden=signed.hidden};new MutationObserver(render).observe(signed,{attributes:true,attributeFilter:["hidden"]});render();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
