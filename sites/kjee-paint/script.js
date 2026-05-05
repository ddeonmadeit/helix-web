(function(){
  var root=document.documentElement,btn=document.getElementById('themeToggle');
  if(btn) btn.addEventListener('click',function(){
    var n=root.getAttribute('data-theme')==='dark'?'light':'dark';
    root.setAttribute('data-theme',n);
    try{localStorage.setItem('theme',n)}catch(e){}
    btn.setAttribute('aria-label','Switch to '+(n==='dark'?'light':'dark')+' theme');
  });
  document.getElementById('yr').textContent=new Date().getFullYear();
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(e){e.forEach(function(x){if(x.isIntersecting){x.target.classList.add('is-in');io.unobserve(x.target)}})},{threshold:.1,rootMargin:'0px 0px -36px 0px'});
    document.querySelectorAll('.reveal').forEach(function(el){io.observe(el)});
  } else {
    document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('is-in')});
  }
})();
