/* Local figure animation only. Every story section stays in normal document flow. */
(() => {
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const figures=[...document.querySelectorAll('.kd-deck-bubbles')];
  const diagrams=[...document.querySelectorAll('.kd-transfer-visual,.kd-validation-visual,[data-kd-diagram]')];
  const timers=new Map();
  const played=new WeakSet();
  const showBuild=(figure,build)=>figure.querySelectorAll('[data-build]').forEach(el=>el.classList.toggle('on',Number(el.dataset.build)<=build));
  function play(figure){
    if(motion.matches)return;
    clearTimeout(timers.get(figure));
    played.add(figure);
    figure.classList.add('kd-deck-animated');
    showBuild(figure,2);
    timers.set(figure,setTimeout(()=>{
      showBuild(figure,3);
      timers.delete(figure);
    },750));
  }
  function playDiagram(figure){
    if(motion.matches||!figure)return;
    clearTimeout(timers.get(figure));
    played.add(figure);
    figure.classList.remove('is-playing');
    void figure.offsetWidth;
    figure.classList.add('is-playing');
    timers.set(figure,setTimeout(()=>{
      figure.classList.remove('is-playing');
      timers.delete(figure);
    },4200));
  }
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting&&!motion.matches&&!played.has(entry.target)){
        if(entry.target.classList.contains('kd-deck-bubbles'))play(entry.target);
        else playDiagram(entry.target);
      }
    });
  },{threshold:.45}):null;
  document.querySelectorAll('[data-kd-replay]').forEach(button=>{
    const figure=button.parentElement.querySelector('.kd-deck-bubbles');
    button.hidden=motion.matches;
    button.addEventListener('click',()=>play(figure));
  });
  document.querySelectorAll('[data-kd-diagram-replay]').forEach(button=>{
    const figure=button.parentElement.querySelector('.kd-transfer-visual,.kd-validation-visual,[data-kd-diagram]');
    button.addEventListener('click',()=>playDiagram(figure));
  });
  function applyMotionPreference(){
    figures.forEach(figure=>{
      clearTimeout(timers.get(figure));
      timers.delete(figure);
      // Full result is the baseline view, including no-JS and reduced-motion.
      figure.classList.remove('kd-deck-animated');
      showBuild(figure,3);
      if(observer&&!motion.matches&&!played.has(figure)){
        figure.classList.add('kd-deck-animated');
        showBuild(figure,2);
      }
      if(observer){observer.unobserve(figure);if(!motion.matches)observer.observe(figure);}
    });
    diagrams.forEach(figure=>{
      clearTimeout(timers.get(figure));
      timers.delete(figure);
      figure.classList.remove('is-playing');
      if(observer){observer.unobserve(figure);if(!motion.matches)observer.observe(figure);}
    });
    document.querySelectorAll('[data-kd-replay],[data-kd-diagram-replay]').forEach(button=>button.hidden=motion.matches);
  }
  motion.addEventListener('change',applyMotionPreference);
  applyMotionPreference();
})();
