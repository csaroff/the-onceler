// Everything written on top of the picture: money, captions, hints, menus, bars.
import { QUOTES } from './quotes.js';

const $ = (id) => document.getElementById(id);
export const dollars = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function createUI() {
  const shown = {};
  // Only touch the page when the text actually changes.
  const show = (id, html) => { if (shown[id] !== html) { shown[id] = html; $(id).innerHTML = html; } };
  const captions = [];
  let captionTimer = 0, tipTimer = 0, omenTimer = 0;

  return {
    money: (n) => show('money', dollars(n)),
    status: (html) => show('status', html),
    goal: (text) => show('goal', text || ''),
    hint: (text) => show('hint', text || ''),
    menu: (html) => { show('menu', html || ''); $('menu').style.display = html ? 'block' : 'none'; },
    health: (fraction) => { $('healthFill').style.width = `${Math.max(0, fraction) * 100}%`; $('health').style.opacity = fraction < 0.999 ? 1 : 0; },
    boss(name, fraction) {
      $('boss').style.display = name ? 'block' : 'none';
      if (name) { show('bossName', name); $('bossFill').style.width = `${Math.max(0, fraction) * 100}%`; }
    },
    wave: (text) => show('wave', text || ''),
    // Marks along a strip: `rel` is the angle to the thing, 0 dead ahead, positive to the right.
    compass(marks) {
      show('compass', marks.map((m) => `<span class="${m.cls || ''}" style="left:${(50 + Math.max(-1, Math.min(1, m.rel / 1.3)) * 50).toFixed(1)}%">${m.label}</span>`).join(''));
    },
    pop(text, spend = false) {
      const el = document.createElement('div');
      el.className = spend ? 'pop spend' : 'pop';
      el.textContent = text;
      $('pops').append(el);
      setTimeout(() => el.remove(), 1300);
      $('money').classList.add('bump');
      setTimeout(() => $('money').classList.remove('bump'), 130);
    },
    // A line from the book, with who said it.
    say(key, seconds = 5) { for (const [speaker, text] of QUOTES[key]) captions.push({ speaker, text, seconds }); },
    clearCaptions() { captions.length = 0; captionTimer = 0; },
    // The game talking, not the book: instructions and news. Never in quotation marks.
    tip(text, seconds = 7) { show('tip', text); $('tip').style.opacity = 1; tipTimer = seconds; },
    omen() { omenTimer = 3; },
    flash() { $('hurt').style.opacity = 0.55; setTimeout(() => { $('hurt').style.opacity = 0; }, 120); },
    letterbox: (on) => document.body.classList.toggle('cutscene', on),
    fade: (on) => { $('fade').style.opacity = on ? 1 : 0; },
    card(html) { show('card', html || ''); $('card').style.display = html ? 'flex' : 'none'; },
    update(dt) {
      captionTimer -= dt;
      if (captionTimer <= 0) {
        $('caption').style.opacity = 0;
        if (captionTimer < -0.7 && captions.length) {
          const next = captions.shift();
          show('caption', next.text === 'UNLESS' ? '<span class="unless">UNLESS</span>' : `“${next.text}”<small>${next.speaker}</small>`);
          $('caption').style.opacity = 1;
          captionTimer = next.seconds;
        }
      }
      tipTimer -= dt;
      if (tipTimer <= 0) $('tip').style.opacity = 0;
      omenTimer = Math.max(0, omenTimer - dt);
      $('omen').style.opacity = Math.min(1, omenTimer) * 0.8;
    },
    captionsPending: () => captions.length > 0 || captionTimer > 0,
  };
}
