import {
  PLAYER_COLOURS, fishIcon, sharkIcon, starIcon, deviceIcon, sunIcon, playIcon, againIcon, homeIcon,
  pauseIcon, soundIcon, fullscreenIcon, crownIcon, tapIcon, schoolIcon,
} from './icons.js';

// All the DOM on top of the 3D view: HUD, menus, results. Picture-first.

const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

const catchIcon = (spec, size) =>
  spec.boss ? sharkIcon(size * 1.8) : fishIcon(spec.palette.side, { rarity: spec.rarity, size, tail: spec.palette.tail });

const HELPERS = [
  { level: 2, size: 26, label: 'lots of help' },
  { level: 1, size: 38, label: 'a little help' },
  { level: 0, size: 52, label: 'no help' },
];

export class UI {
  constructor(root, handlers) {
    this.handlers = handlers;
    this.root = root;
    this.shownScore = 0;
    this.targetScore = 0;

    root.append(h(`
      <div class="hud" hidden>
        <div class="sun-track"><div class="sun-arc"></div><div class="sun">${sunIcon}</div></div>
        <div class="score-pill">${fishIcon('#ffb04a', { size: 40 })}<span class="score">0</span></div>
        <div class="boss-bar" hidden>${sharkIcon(46)}<div class="bar"><i></i></div></div>
        ${[0, 1].map((i) => `
        <div class="tray p${i + 1}" style="--pc:${PLAYER_COLOURS[i]}">
          <div class="badge"></div>
          <div class="combo" hidden></div>
          <div class="catches"></div>
        </div>`).join('')}
        <div class="banner" hidden></div>
        <div class="reel" hidden><div class="tap">${tapIcon}${tapIcon}</div><div class="meter"><i></i><span class="goal">${sharkIcon(40)}</span></div></div>
      </div>`));

    root.append(h(`
      <div class="corner">
        <button class="icon-btn pause-btn" aria-label="Pause" hidden>${pauseIcon}</button>
        <button class="icon-btn sound-btn" aria-label="Sound on or off">${soundIcon(true)}</button>
        <button class="icon-btn fs-btn" aria-label="Full screen">${fullscreenIcon}</button>
      </div>`));

    root.append(h(`
      <div class="screen menu">
        <h1 class="logo"><span class="l1">Harpoon</span><span class="l2">Lagoon</span></h1>
        <div class="players">
          ${[0, 1].map((i) => `
          <section class="pcard p${i + 1}${i === 0 ? ' joined' : ''}" style="--pc:${PLAYER_COLOURS[i]}">
            <div class="pcard-head"><span class="device"></span></div>
            <div class="join">${tapIcon}<span class="join-label">press fire to join</span></div>
            <div class="helpers">
              ${HELPERS.map((x) => `<button class="helper" data-level="${x.level}" aria-label="${x.label}">${fishIcon(PLAYER_COLOURS[i], { size: x.size })}<small>${x.label}</small></button>`).join('')}
            </div>
          </section>`).join('')}
        </div>
        <button class="play big-btn" aria-label="Play">${playIcon}</button>
        <div class="best"></div>
        <p class="grownups">For grown-ups: blue aims with the mouse (or the first of two gamepads), orange with the arrow keys and Space (or a gamepad).
          Hold fire to shoot further. Pick fish size = how much aim help each player gets. Esc pauses.</p>
      </div>`));

    root.append(h(`
      <div class="screen results" hidden>
        <div class="stars"></div>
        <div class="record" hidden>${crownIcon}</div>
        <div class="total">${fishIcon('#ffb04a', { size: 54 })}<span></span></div>
        <div class="gallery"></div>
        <ol class="scores"></ol>
        <div class="row">
          <button class="again big-btn" aria-label="Play again">${againIcon}</button>
          <button class="home big-btn small" aria-label="Back to start">${homeIcon}</button>
        </div>
      </div>`));

    root.append(h(`
      <div class="screen pause" hidden>
        <div class="row">
          <button class="resume big-btn" aria-label="Keep playing">${playIcon}</button>
          <button class="quit big-btn small" aria-label="Back to start">${homeIcon}</button>
        </div>
      </div>`));

    root.append(h('<div class="floats"></div>'));

    const $ = (s) => root.querySelector(s);
    this.el = {
      hud: $('.hud'), score: $('.score'), sun: $('.sun'), bossBar: $('.boss-bar'), bossFill: $('.boss-bar i'),
      banner: $('.banner'), reel: $('.reel'), reelFill: $('.reel .meter i'),
      menu: $('.menu'), results: $('.results'), pause: $('.pause'), pauseBtn: $('.pause-btn'),
      soundBtn: $('.sound-btn'), floats: $('.floats'), best: $('.best'),
      trays: [...root.querySelectorAll('.tray')], cards: [...root.querySelectorAll('.pcard')],
    };

    $('.play').addEventListener('click', () => handlers.onPlay());
    $('.again').addEventListener('click', () => handlers.onAgain());
    $('.home').addEventListener('click', () => handlers.onHome());
    $('.resume').addEventListener('click', () => handlers.onResume());
    $('.quit').addEventListener('click', () => handlers.onHome());
    this.el.pauseBtn.addEventListener('click', () => handlers.onPause());
    this.el.soundBtn.addEventListener('click', () => handlers.onMute());
    $('.fs-btn').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    this.el.cards.forEach((card, i) => {
      card.querySelectorAll('.helper').forEach((b) =>
        b.addEventListener('click', () => handlers.onHelper(i, Number(b.dataset.level))));
      card.querySelector('.join').addEventListener('click', () => handlers.onJoin(i));
    });
  }

  get floats() {
    return this.el.floats;
  }

  // --- Menu ---
  showMenu({ helpers, joined, devices, best }) {
    this.el.menu.hidden = false;
    this.el.results.hidden = true;
    this.el.pause.hidden = true;
    this.el.hud.hidden = true;
    this.el.pauseBtn.hidden = true;
    this.updateMenu({ helpers, joined, devices });
    this.el.best.innerHTML = best > 0 ? `${crownIcon}<span>${best}</span>` : '';
  }

  updateMenu({ helpers, joined, devices }) {
    this.el.cards.forEach((card, i) => {
      card.classList.toggle('joined', joined[i]);
      card.querySelector('.device').innerHTML = deviceIcon(i === 0 ? devices.p1 : devices.p2);
      card.querySelectorAll('.helper').forEach((b) =>
        b.classList.toggle('selected', Number(b.dataset.level) === helpers[i]));
    });
  }

  // --- HUD ---
  startHud(joined, devices) {
    this.el.menu.hidden = true;
    this.el.results.hidden = true;
    this.el.pause.hidden = true;
    this.el.hud.hidden = false;
    this.el.pauseBtn.hidden = false;
    this.shownScore = this.targetScore = 0;
    this.el.score.textContent = '0';
    this.el.trays.forEach((t, i) => {
      t.hidden = !joined[i];
      t.querySelector('.catches').innerHTML = '';
      t.querySelector('.badge').innerHTML = deviceIcon(i === 0 ? devices.p1 : devices.p2);
      t.dataset.count = '0';
    });
    this.setCombo(0, 0);
    this.setCombo(1, 0);
    this.boss(false);
    this.reel(false);
    this.el.banner.hidden = true;
  }

  setScore(n) {
    this.targetScore = n;
  }

  // Screen point the floating score numbers fly to.
  scoreTarget() {
    const r = this.el.score.getBoundingClientRect();
    const o = this.root.getBoundingClientRect();
    return { x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2 };
  }

  tick(dt) {
    if (this.shownScore !== this.targetScore) {
      const step = Math.max(1, Math.ceil((this.targetScore - this.shownScore) * Math.min(1, dt * 8)));
      this.shownScore = Math.min(this.targetScore, this.shownScore + step);
      this.el.score.textContent = String(this.shownScore);
      this.el.score.parentElement.classList.remove('bump');
      void this.el.score.offsetWidth;
      this.el.score.parentElement.classList.add('bump');
    }
  }

  setSun(k) {
    // Sun travels along an arc from left (morning) to right (sunset).
    const x = k * 100;
    const y = Math.sin(k * Math.PI) * -22 + 4 + k * 14;
    this.el.sun.style.left = `${x}%`;
    this.el.sun.style.transform = `translate(-50%, ${y}px)`;
    this.el.sun.classList.toggle('setting', k > 0.85);
  }

  addCatch(player, spec) {
    const tray = this.el.trays[player];
    const box = tray.querySelector('.catches');
    const n = Number(tray.dataset.count) + 1;
    tray.dataset.count = String(n);
    const icon = h(`<span class="catch pop">${catchIcon(spec, 30)}</span>`);
    box.prepend(icon);
    while (box.children.length > 9) box.lastElementChild.remove();
    box.dataset.more = n > 9 ? `${n}` : '';
  }

  setCombo(player, combo) {
    const el = this.el.trays[player].querySelector('.combo');
    el.hidden = combo < 2;
    el.textContent = `x${combo}`;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  boss(show, frac = 1) {
    this.el.bossBar.hidden = !show;
    this.el.bossFill.style.width = `${Math.max(0, frac) * 100}%`;
  }

  reel(show, frac = 0) {
    this.el.reel.hidden = !show;
    this.el.reelFill.style.width = `${Math.min(1, frac) * 100}%`;
  }

  banner(kind, ms = 2200) {
    const el = this.el.banner;
    el.innerHTML = kind === 'boss' ? `${sharkIcon(140)}` : kind === 'frenzy' ? schoolIcon : kind === 'go' ? playIcon : kind;
    el.className = `banner ${kind}`;
    el.hidden = false;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => (el.hidden = true), ms);
  }

  // --- Pause ---
  showPause(on) {
    this.el.pause.hidden = !on;
  }

  setMuted(m) {
    this.el.soundBtn.innerHTML = soundIcon(!m);
  }

  // --- Results ---
  showResults({ score, stars, catches, joined, record, scores }, onStar) {
    this.el.hud.hidden = true;
    this.el.pauseBtn.hidden = true;
    const r = this.el.results;
    r.hidden = false;
    r.querySelector('.total span').textContent = String(score);
    r.querySelector('.record').hidden = !record;
    const starBox = r.querySelector('.stars');
    starBox.innerHTML = Array.from({ length: 5 }, () => `<span class="star">${starIcon(false, 64)}</span>`).join('');
    clearTimeout(this.starTimer);
    let i = 0;
    const next = () => {
      if (i >= stars) return;
      const s = starBox.children[i];
      s.innerHTML = starIcon(true, 64);
      s.classList.add('pop');
      onStar?.(i);
      i++;
      this.starTimer = setTimeout(next, 380);
    };
    this.starTimer = setTimeout(next, 500);

    r.querySelector('.gallery').innerHTML = [0, 1]
      .filter((p) => joined[p])
      .map((p) => {
        const list = catches[p];
        const icons = list.slice(0, 40).map((s) =>
          `<span class="catch">${catchIcon(s, 32)}</span>`).join('');
        return `<div class="gallery-row" style="--pc:${PLAYER_COLOURS[p]}"><span class="dot"></span>${icons || '<span class="empty">·</span>'}${list.length > 40 ? `<b>+${list.length - 40}</b>` : ''}</div>`;
      }).join('');

    r.querySelector('.scores').innerHTML = scores.slice(0, 5).map((s) =>
      `<li class="${s.isNew ? 'new' : ''}"><span class="mini-stars">${'★'.repeat(s.stars)}<i>${'★'.repeat(5 - s.stars)}</i></span><b>${s.score}</b></li>`).join('');
  }
}
