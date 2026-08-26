/* Adds the repository path-surface to the shared product navigation without creating a new hostname. */
(function repositoryNav(){
"use strict";
function install(){const nav=document.querySelector(".topbar .nav");if(!nav||nav.querySelector('[data-idol-repository]'))return;const link=document.createElement("a");link.dataset.idolRepository="";link.href="https://platform.idol.id/repo";link.title="Repository Observatory";link.textContent="repos";if(location.hostname==="platform.idol.id"&&/^\/repo(?:\/|$)/.test(location.pathname)){nav.querySelectorAll(".here").forEach(x=>x.classList.remove("here"));link.classList.add("here")}const platform=[...nav.querySelectorAll("a")].find(x=>x.textContent.trim()==="platform");if(platform)nav.insertBefore(link,platform);else nav.append(link);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
})();
