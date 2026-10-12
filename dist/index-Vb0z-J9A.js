import { computed as X, watch as _e, ref as J, onBeforeUnmount as je, defineComponent as qe, openBlock as q, createElementBlock as oe, withModifiers as We, normalizeStyle as $e, normalizeClass as Ye, createCommentVNode as ze, createElementVNode as ne, renderSlot as Ge, toDisplayString as Ie, nextTick as dt, reactive as At, onMounted as Ft, unref as Q, Fragment as Ue, renderList as Be, createTextVNode as ft, createBlock as nt, withCtx as Wt, mergeProps as Ut } from "vue";
import W from "dayjs";
var rt = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function at(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
var pt = { exports: {} };
(function(n, l) {
  (function(e, s) {
    n.exports = s();
  })(rt, function() {
    var e = "minute", s = /[+-]\d\d(?::?\d\d)?/g, m = /([+-]|\d\d)/g;
    return function(P, c, v) {
      var i = c.prototype;
      v.utc = function(f) {
        var R = { date: f, utc: !0, args: arguments };
        return new c(R);
      }, i.utc = function(f) {
        var R = v(this.toDate(), { locale: this.$L, utc: !0 });
        return f ? R.add(this.utcOffset(), e) : R;
      }, i.local = function() {
        return v(this.toDate(), { locale: this.$L, utc: !1 });
      };
      var p = i.parse;
      i.parse = function(f) {
        f.utc && (this.$u = !0), this.$utils().u(f.$offset) || (this.$offset = f.$offset), p.call(this, f);
      };
      var M = i.init;
      i.init = function() {
        if (this.$u) {
          var f = this.$d;
          this.$y = f.getUTCFullYear(), this.$M = f.getUTCMonth(), this.$D = f.getUTCDate(), this.$W = f.getUTCDay(), this.$H = f.getUTCHours(), this.$m = f.getUTCMinutes(), this.$s = f.getUTCSeconds(), this.$ms = f.getUTCMilliseconds();
        } else M.call(this);
      };
      var b = i.utcOffset;
      i.utcOffset = function(f, R) {
        var Y = this.$utils().u;
        if (Y(f)) return this.$u ? 0 : Y(this.$offset) ? b.call(this) : this.$offset;
        if (typeof f == "string" && (f = function(Z) {
          Z === void 0 && (Z = "");
          var se = Z.match(s);
          if (!se) return null;
          var te = ("" + se[0]).match(m) || ["-", 0, 0], le = te[0], K = 60 * +te[1] + +te[2];
          return K === 0 ? 0 : le === "+" ? K : -K;
        }(f), f === null)) return this;
        var U = Math.abs(f) <= 16 ? 60 * f : f;
        if (U === 0) return this.utc(R);
        var _ = this.clone();
        if (R) return _.$offset = U, _.$u = !1, _;
        var ee = this.$u ? this.toDate().getTimezoneOffset() : -1 * this.utcOffset();
        return (_ = this.local().add(U + ee, e)).$offset = U, _.$x.$localOffset = ee, _;
      };
      var d = i.format;
      i.format = function(f) {
        var R = f || (this.$u ? "YYYY-MM-DDTHH:mm:ss[Z]" : "");
        return d.call(this, R);
      }, i.valueOf = function() {
        var f = this.$utils().u(this.$offset) ? 0 : this.$offset + (this.$x.$localOffset || this.$d.getTimezoneOffset());
        return this.$d.valueOf() - 6e4 * f;
      }, i.isUTC = function() {
        return !!this.$u;
      }, i.toISOString = function() {
        return this.toDate().toISOString();
      }, i.toString = function() {
        return this.toDate().toUTCString();
      };
      var w = i.toDate;
      i.toDate = function(f) {
        return f === "s" && this.$offset ? v(this.format("YYYY-MM-DD HH:mm:ss:SSS")).toDate() : w.call(this);
      };
      var g = i.diff;
      i.diff = function(f, R, Y) {
        if (f && this.$u === f.$u) return g.call(this, f, R, Y);
        var U = this.local(), _ = v(f).local();
        return g.call(U, _, R, Y);
      };
    };
  });
})(pt);
var Bt = pt.exports;
const wt = /* @__PURE__ */ at(Bt);
var gt = { exports: {} };
(function(n, l) {
  (function(e, s) {
    n.exports = s();
  })(rt, function() {
    var e = { year: 0, month: 1, day: 2, hour: 3, minute: 4, second: 5 }, s = {};
    return function(m, P, c) {
      var v, i = function(d, w, g) {
        g === void 0 && (g = {});
        var f = new Date(d), R = function(Y, U) {
          U === void 0 && (U = {});
          var _ = U.timeZoneName || "short", ee = Y + "|" + _, Z = s[ee];
          return Z || (Z = new Intl.DateTimeFormat("en-US", { hour12: !1, timeZone: Y, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: _ }), s[ee] = Z), Z;
        }(w, g);
        return R.formatToParts(f);
      }, p = function(d, w) {
        for (var g = i(d, w), f = [], R = 0; R < g.length; R += 1) {
          var Y = g[R], U = Y.type, _ = Y.value, ee = e[U];
          ee >= 0 && (f[ee] = parseInt(_, 10));
        }
        var Z = f[3], se = Z === 24 ? 0 : Z, te = f[0] + "-" + f[1] + "-" + f[2] + " " + se + ":" + f[4] + ":" + f[5] + ":000", le = +d;
        return (c.utc(te).valueOf() - (le -= le % 1e3)) / 6e4;
      }, M = P.prototype;
      M.tz = function(d, w) {
        if (d === void 0 && (d = v), !this.isValid()) return this;
        var g, f = this.utcOffset(), R = this.toDate(), Y = R.toLocaleString("en-US", { timeZone: d }), U = p(+R, d);
        if (!Number(U)) g = this.utcOffset(0, w);
        else if (g = c(Y, { locale: this.$L }).$set("millisecond", this.$ms).utcOffset(U, !0), w) {
          var _ = g.utcOffset();
          g = g.add(f - _, "minute");
        }
        return g.$x.$timezone = d, g;
      }, M.offsetName = function(d) {
        var w = this.$x.$timezone || c.tz.guess(), g = i(this.valueOf(), w, { timeZoneName: d }).find(function(f) {
          return f.type.toLowerCase() === "timezonename";
        });
        return g && g.value;
      };
      var b = M.startOf;
      M.startOf = function(d, w) {
        if (!this.$x || !this.$x.$timezone) return b.call(this, d, w);
        var g = c(this.format("YYYY-MM-DD HH:mm:ss:SSS"), { locale: this.$L });
        return b.call(g, d, w).tz(this.$x.$timezone, !0);
      }, c.tz = function(d, w, g) {
        var f = g && w, R = g || w || v, Y = p(+c(), R);
        if (typeof d != "string") return c(d).tz(R);
        var U = c.utc(d, f).valueOf();
        if (Number.isNaN(U)) {
          var _ = c(NaN);
          return _.$x.$timezone = R, _;
        }
        var ee = function(le, K, ge) {
          var re = le - 60 * K * 1e3, ie = p(re, ge);
          if (K === ie) return [re, K];
          var V = p(re -= 60 * (ie - K) * 1e3, ge);
          return ie === V ? [re, ie] : [le - 60 * Math.min(ie, V) * 1e3, Math.max(ie, V)];
        }(U, Y, R), Z = ee[0], se = ee[1], te = c(Z).utcOffset(se);
        return te.$x.$timezone = R, te;
      }, c.tz.guess = function() {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      }, c.tz.setDefault = function(d) {
        v = d;
      };
    };
  });
})(gt);
var Gt = gt.exports;
const Mt = /* @__PURE__ */ at(Gt);
var yt = { exports: {} };
(function(n, l) {
  (function(e, s) {
    n.exports = s();
  })(rt, function() {
    return function(e, s) {
      var m = s.prototype, P = m.format;
      m.format = function(c) {
        var v = this, i = this.$locale();
        if (!this.isValid()) return P.bind(this)(c);
        var p = this.$utils(), M = (c || "YYYY-MM-DDTHH:mm:ssZ").replace(/\[([^\]]+)]|Q|wo|ww|w|WW|W|zzz|z|gggg|GGGG|Do|X|x|k{1,2}|S/g, function(b) {
          switch (b) {
            case "Q":
              return Math.ceil((v.$M + 1) / 3);
            case "Do":
              return i.ordinal(v.$D);
            case "gggg":
              return v.weekYear();
            case "GGGG":
              return v.isoWeekYear();
            case "wo":
              return i.ordinal(v.week(), "W");
            case "w":
            case "ww":
              return p.s(v.week(), b === "w" ? 1 : 2, "0");
            case "W":
            case "WW":
              return p.s(v.isoWeek(), b === "W" ? 1 : 2, "0");
            case "k":
            case "kk":
              return p.s(String(v.$H === 0 ? 24 : v.$H), b === "k" ? 1 : 2, "0");
            case "X":
              return Math.floor(v.$d.getTime() / 1e3);
            case "x":
              return v.$d.getTime();
            case "z":
              return "[" + v.offsetName() + "]";
            case "zzz":
              return "[" + v.offsetName("long") + "]";
            default:
              return b;
          }
        });
        return P.bind(this)(M);
      };
    };
  });
})(yt);
var Nt = yt.exports;
const Vt = /* @__PURE__ */ at(Nt);
W.extend(wt);
W.extend(Mt);
W.extend(Vt);
let ve = null;
function vt(n) {
  ve = n && n.trim() ? n : null;
}
function Rn() {
  return ve;
}
function st(n, l) {
  const e = l.start ?? n.start, s = l.end ?? n.end;
  return { start: e, end: s };
}
function de(n) {
  if (n == null)
    return ve ? W().tz(ve) : W();
  if (typeof n == "string" && ve)
    return W.tz(n, ve);
  if (W.isDayjs(n)) {
    const e = W(n.valueOf());
    return ve ? e.tz(ve) : e;
  }
  const l = W(n);
  return ve ? l.tz(ve) : l;
}
const xt = "D MMM HH:mm", mt = /* @__PURE__ */ new Set(["en"]), jt = J(0);
async function qt(n) {
  const l = $t(n);
  if (!mt.has(l))
    try {
      await import(
        /* @vite-ignore */
        `dayjs/locale/${l}`
      ), mt.add(l), jt.value++;
    } catch {
      l !== "en" && console.warn(`[vue-event-timeline] dayjs locale "${l}" not found, fallback to "en"`);
    }
}
function $t(n) {
  return (n ?? "").split("-")[0].toLowerCase() || "en";
}
function Zt(n, l) {
  const e = X(() => $t(l.value));
  return _e(
    e,
    async (s) => {
      await qt(s);
    },
    { immediate: !0 }
  ), X(() => {
    const s = n.value;
    return s ? de(s).locale(e.value).format(xt) : "";
  });
}
const Cn = (n) => {
  if (!n)
    return null;
  const l = n.format("YYYY-MM-DDTHH:mm:ss.SSS");
  return ve ? W(l).toDate() : new Date(
    n.year(),
    n.month(),
    n.date(),
    n.hour(),
    n.minute(),
    n.second(),
    n.millisecond()
  );
}, Hn = (n) => {
  if (!n)
    return null;
  if (W.isDayjs(n))
    return ve ? n.tz(ve) : n;
  const l = n.getFullYear(), e = n.getMonth(), s = n.getDate(), m = n.getHours(), P = n.getMinutes(), c = n.getSeconds(), v = n.getMilliseconds();
  if (!ve)
    return W(new Date(l, e, s, m, P, c, v));
  const i = `${l}-${String(e + 1).padStart(2, "0")}-${String(s).padStart(2, "0")}T${String(m).padStart(2, "0")}:${String(P).padStart(2, "0")}:${String(c).padStart(2, "0")}.${String(v).padStart(3, "0")}Z`;
  return W.utc(i).tz(ve, !0);
};
function Kt(n) {
  const l = /* @__PURE__ */ new Map();
  if (n.length === 0) return l;
  const e = [...n].sort((c, v) => {
    const i = c.start.valueOf() - v.start.valueOf();
    return i !== 0 ? i : v.end.valueOf() - v.start.valueOf() - (c.end.valueOf() - c.start.valueOf());
  });
  let s = [], m = -1 / 0;
  const P = () => {
    if (s.length === 0) return;
    const c = [], v = /* @__PURE__ */ new Map();
    for (const p of s) {
      const M = p.start.valueOf(), b = Math.max(p.end.valueOf(), M);
      let d = !1;
      for (let w = 0; w < c.length; w++)
        if (c[w] <= M) {
          c[w] = b, v.set(p.id, w), d = !0;
          break;
        }
      d || (c.push(b), v.set(p.id, c.length - 1));
    }
    const i = c.length;
    for (const p of s)
      l.set(p.id, { lane: v.get(p.id) ?? 0, lanes: i });
    s = [];
  };
  for (const c of e) {
    const v = c.start.valueOf(), i = Math.max(c.end.valueOf(), v);
    s.length > 0 && v >= m && (P(), m = -1 / 0), s.push(c), m = Math.max(m, i);
  }
  return P(), l;
}
function Xn(n, l, e, s = 16) {
  const m = Math.max(s, Math.floor(e / l));
  return {
    top: Math.max(0, Math.floor((e - l * m) / 2)) + n * m,
    height: m
  };
}
W.extend(wt);
W.extend(Mt);
function Qt(n, l, e) {
  var ie, V;
  vt(e.value.timezone ?? null);
  const s = J(de().startOf("day")), m = J(e.value.initialPxPerMin ?? 2), P = J(1e3), c = ((ie = e.value.zoomRange) == null ? void 0 : ie.min) ?? 0.02, v = ((V = e.value.zoomRange) == null ? void 0 : V.max) ?? 10, i = X(() => e.value.minCellMinutes ?? 15), p = X(() => e.value.eventGapMinutes ?? 0), M = X(() => {
    const D = P.value / m.value;
    return d(s.value, D);
  }), b = (D) => {
    const x = i.value * 6e4;
    return de(Math.round(D.valueOf() / x) * x);
  }, d = (D, x) => D.add(x, "minute"), w = (D, x) => (D.valueOf() - x.valueOf()) / 6e4, g = (D, x, O, A) => {
    if (e.value.allowOverlap) return !1;
    const H = p.value * 60 * 1e3;
    return n.value.some((C) => C.id === A || C.resourceId !== D ? !1 : C.start.valueOf() < O.valueOf() + H && C.end.valueOf() > x.valueOf() - H);
  }, f = (D, x) => {
    let O = D, A = x;
    const H = e.value.minDate ? e.value.minDate : null, C = e.value.maxDate ? e.value.maxDate : null;
    if (H && (O.isBefore(H) && (O = H), A.isBefore(H) && (A = H)), C && (A.isAfter(C) && (A = C), O.isAfter(C) && (O = C)), O.isAfter(A)) {
      const ue = O;
      O = A, A = ue;
    }
    return { start: O, end: A };
  }, R = (D, x) => {
    const O = b(D);
    let A = b(x);
    const H = e.value.minDurationMinutes ?? i.value, C = e.value.maxDurationMinutes ?? 1 / 0, ue = w(A, O);
    return ue < H ? A = d(O, H) : ue > C && (A = d(O, C)), f(O, A);
  }, Y = (D, x) => {
    const O = D > 0 ? 0.9 : 1.1, A = m.value * O, H = Math.round(A * 1e3) / 1e3, C = Math.max(c, Math.min(v, H));
    if (!(C === m.value && x === void 0))
      if (x !== void 0) {
        const Le = s.value.valueOf() / 6e4 + x / m.value - x / C;
        m.value = C, s.value = de(Le * 6e4);
      } else
        m.value = C;
  }, U = (D) => w(D, s.value) * m.value, _ = (D) => d(s.value, D / m.value), ee = X(() => {
    const D = m.value * 60;
    return D < 2 ? "month" : D < 30 ? "day" : D < 100 ? "hour" : "minute";
  }), Z = (D) => n.value.filter((x) => x.resourceId === D), se = J(null), te = X(() => {
    const D = /* @__PURE__ */ new Map(), x = s.value.valueOf(), O = M.value.valueOf(), A = se.value;
    for (const H of n.value)
      if (A !== null && H.id === A || H.end.valueOf() >= x && H.start.valueOf() <= O) {
        const C = D.get(H.resourceId);
        C ? C.push(H) : D.set(H.resourceId, [H]);
      }
    return D;
  }), le = (D) => te.value.get(D) ?? [], K = X(() => {
    const D = /* @__PURE__ */ new Map();
    if (!e.value.allowOverlap) return D;
    for (const [x, O] of te.value)
      O.length < 2 || D.set(x, Kt(O));
    return D;
  }), ge = (D, x) => {
    var O;
    return (O = K.value.get(D)) == null ? void 0 : O.get(x);
  };
  _e(
    () => e.value.timezone ?? null,
    (D, x) => {
      x === null && D === null || (vt(D), s.value = de(s.value.valueOf()).startOf("day"));
    }
  );
  const re = X(() => (e.value.timezone, de().utcOffset()));
  return {
    viewStart: s,
    viewEnd: M,
    pxPerMin: m,
    containerWidth: P,
    zoomLevel: ee,
    timezoneOffsetMinutes: re,
    // <-- Используйте это в расчете gridStyle вместо хардкода
    snap: b,
    addMin: d,
    diffMin: w,
    hasOverlap: g,
    clampToBounds: f,
    clampDuration: R,
    zoom: Y,
    getX: U,
    getDateFromX: _,
    eventsByResource: Z,
    eventsToShow: le,
    visibleEventsByResource: te,
    activeDragEventId: se,
    // FIX: id активного drag/resize-события — не фильтруется по viewport
    getLaneFor: ge,
    // T-29: lane-раскладка перекрывающихся событий
    minCellMin: i,
    normalizeEventChanges: st
    // T-26: нормализация changes перед clamp/overlap
  };
}
const Se = {
  /** px/час ниже этого — показываем годы */
  year: 1.5,
  /** px/час ниже этого — показываем месяцы */
  month: 4,
  /** px/час ниже этого — показываем дни */
  day: 15,
  /** px/час ниже этого — часовые метки, выше — минутные */
  hour: 35,
  /** px/час для 15-минутных меток */
  minute: 120
}, ot = (n, l) => (n - l.viewStartMs) / 6e4 * l.pxPerMin;
function He(n, l, e, s, m) {
  const P = [], c = e.subtract(1, l);
  for (let v = 0; v < 72; v++) {
    const i = c.subtract(v, l), p = ot(i.valueOf(), n), M = m(i);
    if (p + M < 0) break;
    P.push({ time: i.valueOf(), x: p, width: M, label: s(i), type: l, sticky: !1 });
  }
  for (let v = 0; v < 144; v++) {
    const i = e.add(v, l), p = ot(i.valueOf(), n);
    if (p > n.width + 100) break;
    P.push({ time: i.valueOf(), x: p, width: m(i), label: s(i), type: l, sticky: !1 });
  }
  return P;
}
const St = (n) => n >= Se.minute ? 15 : n >= Se.hour ? 60 : n >= Se.day ? 240 : n >= Se.month ? 480 : (n >= Se.year, 1440);
function Jt(n, l) {
  const e = [], s = St(l);
  let m = de(n.viewStartMs).startOf("day").subtract(s, "minute");
  for (let P = 0; P < 5e3; P++) {
    const c = m.valueOf(), v = ot(c, n);
    if (v > n.width + 50) break;
    if (v >= -50) {
      const i = m.minute() === 0 && m.second() === 0;
      e.push({
        time: c,
        x: v,
        width: s * n.pxPerMin,
        label: m.format("HH:mm"),
        type: i ? "hour" : "minute",
        sticky: !1
      });
    }
    m = m.add(s, "minute");
  }
  return e;
}
function en(n) {
  let l = null;
  for (const e of n)
    e.x < 0 && e.x + (e.width || 0) > 0 && (!l || e.x > l.x) && (l = e);
  return n.map((e) => {
    if (l && e.time === l.time && e.type === l.type) {
      const s = l.width + l.x;
      return s < 100 ? { ...e, sticky: !1 } : { ...e, sticky: !0, x: 0, width: s };
    }
    return { ...e, sticky: !1 };
  });
}
function tn(n, l, e, s) {
  const m = X(() => ({
    viewStartMs: n.value.valueOf(),
    pxPerMin: l.value,
    width: e.value
  })), P = () => (s == null ? void 0 : s.value) ?? "en", c = (p) => de(p).locale(P()), v = X(() => {
    const p = m.value, M = p.pxPerMin * 60, b = c(p.viewStartMs), d = (g) => g * p.pxPerMin;
    let w;
    return M >= Se.day ? w = He(p, "day", b.startOf("day"), (g) => c(g).format("dd, D MMM"), () => d(1440)) : M >= Se.month ? w = He(
      p,
      "month",
      b.startOf("month"),
      (g) => c(g).format("MMMM YYYY"),
      (g) => d(g.daysInMonth() * 1440)
    ) : M >= Se.year ? w = He(
      p,
      "month",
      b.startOf("month"),
      (g) => c(g).format("MMM YYYY"),
      (g) => d(g.daysInMonth() * 1440)
    ) : w = He(
      p,
      "year",
      b.startOf("year"),
      (g) => g.format("YYYY"),
      (g) => d(g.endOf("year").diff(g.startOf("year"), "minute", !0))
    ), en(w);
  }), i = X(() => {
    const p = m.value, M = p.pxPerMin * 60, b = c(p.viewStartMs), d = (w) => w * p.pxPerMin;
    return M < Se.year ? He(
      p,
      "month",
      b.startOf("month"),
      (w) => c(w).format("MMM"),
      (w) => d(w.daysInMonth() * 1440)
    ) : M < Se.day ? He(
      p,
      "day",
      b.startOf("day"),
      (w) => `${w.format("D")} ${c(w).format("dd")}`,
      () => d(1440)
    ) : Jt(p, M);
  });
  return { topMarks: v, bottomMarks: i };
}
const nn = 100, sn = 500;
function on(n) {
  const e = J(160), s = J(!1), m = J(null), P = J(null);
  let c = 0, v = 0;
  const i = (w) => {
    m.value && (m.value.style.width = `${w}px`), P.value && (P.value.style.width = `${w}px`);
  }, p = () => i(e.value), M = (w) => {
    s.value && (w.preventDefault(), i(Math.max(nn, Math.min(sn, v + (w.clientX - c)))));
  }, b = (w) => {
    if (s.value = !1, document.body.style.userSelect = "", document.body.style.cursor = "", window.removeEventListener("pointermove", M), window.removeEventListener("pointerup", b), window.removeEventListener("pointercancel", b), w.type === "pointercancel") {
      e.value = v, i(v);
      return;
    }
    if (m.value) {
      const g = parseInt(m.value.style.width, 10);
      Number.isFinite(g) && (e.value = g);
    }
  }, d = (w) => {
    w.preventDefault(), s.value = !0, c = w.clientX, v = e.value, document.body.style.userSelect = "none", document.body.style.cursor = "col-resize", window.addEventListener("pointermove", M, { passive: !1 }), window.addEventListener("pointerup", b), window.addEventListener("pointercancel", b);
  };
  return je(() => {
    window.removeEventListener("pointermove", M), window.removeEventListener("pointerup", b), window.removeEventListener("pointercancel", b), document.body.style.userSelect = "", document.body.style.cursor = "";
  }), { sidebarWidth: e, isResizing: s, sidebarRef: m, rulerSpacerRef: P, applySavedWidth: p, onResizePointerDown: d };
}
function rn(n, l, e, s = 6e4) {
  const m = J(de());
  let P = null;
  const c = () => {
    P !== null && (clearInterval(P), P = null);
  };
  _e(e, () => {
    c(), e.value && (P = window.setInterval(() => {
      m.value = de();
    }, s));
  }, { immediate: !0 });
  const i = X(() => e.value ? m.value.diff(n.value, "minute", !0) * l.value : null);
  return je(c), { now: m, currentTimeX: i };
}
const an = { class: "tl-event-body" }, ln = { class: "tl-event-title" }, un = { class: "tl-event-dur" }, cn = ["title"], Xe = 80, ht = 15, dn = /* @__PURE__ */ qe({
  __name: "TimelineEvent",
  props: {
    event: {},
    viewStart: {},
    pxPerMin: {},
    canEditGlobal: { type: Boolean },
    canDeleteGlobal: { type: Boolean },
    canvasWidth: {},
    dragShiftPx: {},
    deleteTitle: { default: "Delete" },
    rowHeight: { default: 40 },
    laneStyle: {},
    canMoveTo: {},
    normalizePosition: {},
    snapMinutes: { default: 15 }
  },
  emits: ["update", "save", "delete", "click", "request-autoscroll", "hover-event", "drag-state"],
  setup(n, { emit: l }) {
    const e = n, s = l, m = X(() => e.canEditGlobal && e.event.canEdit !== !1), P = X(() => e.canDeleteGlobal && e.event.canDelete !== !1), c = X(() => m.value && e.event.canDrag !== !1), v = X(() => m.value && e.event.canResize !== !1), i = J(null), p = J(!1), M = (y) => {
      const u = Math.max(1, e.snapMinutes) * 6e4;
      return de(Math.round(y.valueOf() / u) * u);
    }, b = (y, u) => {
      if (!e.canMoveTo) return !0;
      const a = e.normalizePosition ? e.normalizePosition(y, u) : { start: M(y), end: M(u) };
      return e.canMoveTo(a.start, a.end);
    }, d = (y, u) => {
      if (e.normalizePosition) return e.normalizePosition(y, u);
      const a = e.snapMinutes * 6e4;
      return a <= 0 ? { start: y, end: u } : { start: de(Math.round(y.valueOf() / a) * a), end: de(Math.round(u.valueOf() / a) * a) };
    }, w = (y, u) => {
      const a = y(u);
      return b(a.start, a.end);
    }, g = (y, u) => {
      const a = y(u);
      return b(a.start, a.end) ? d(a.start, a.end) : null;
    }, f = (y, u, a) => {
      const L = ($) => {
        const F = a($), N = d(F.start, F.end);
        return e.canMoveTo ? e.canMoveTo(N.start, N.end) : !0;
      };
      let h = Math.min(y, u), E = Math.max(y, u);
      for (; E - h > 6e4; ) {
        const $ = Math.floor((h + E) / 2);
        L($) ? y < u ? E = $ : h = $ : y < u ? h = $ : E = $;
      }
      let I = null;
      for (const $ of [3e4, 1e4, 5e3, 1e3]) {
        const F = I !== null ? I : y, N = u > y ? 1 : -1;
        for (let B = F + N * $; (N === 1 ? B <= u : B >= u) && L(B); B += N * $)
          I = B;
      }
      return I !== null ? I : u;
    }, R = (y, u, a, L) => {
      const h = (E) => {
        const I = a(E), $ = d(I.start, I.end);
        return e.canMoveTo ? e.canMoveTo($.start, $.end) : !0;
      };
      for (let E = 0; E <= L; E++) {
        const I = y + u * E * 6e4;
        if (h(I)) {
          if (E === 0) {
            const ae = a(I);
            return d(ae.start, ae.end);
          }
          const $ = I - u * 6e4, F = f($, I, a), N = g(a, F);
          if (N && h(F)) return N;
          const B = a(I);
          return d(B.start, B.end);
        }
      }
      return null;
    }, Y = (y, u, a, L, h, E) => {
      const I = h || E === "start", $ = I ? a : L, F = I ? y : u, N = u.valueOf() - y.valueOf(), B = L, ae = a, Oe = !!e.normalizePosition, we = (j) => I ? h ? { start: W(j), end: W(j + N) } : { start: W(j), end: B } : { start: ae, end: W(j) }, ye = $.valueOf() >= F.valueOf() ? 1 : -1;
      if (!e.canMoveTo) {
        const j = h ? ye === 1 ? L.valueOf() : a.valueOf() : I ? u.valueOf() : y.valueOf(), me = we(j);
        return d(me.start, me.end);
      }
      if (b(a, L)) return d(a, L);
      const Pe = F.valueOf(), be = $.valueOf(), Me = Math.round(Math.abs(Pe - be) / 6e4), De = w(we, Pe);
      if (Oe) {
        const j = R(be, ye === 1 ? -1 : 1, we, Me + 1);
        if (j && De) return j;
        const me = R(be, ye === 1 ? -1 : 1, we, 480);
        if (me && (!j || !De)) return me;
        if (j) return j;
        if (me) return me;
      } else {
        const j = Math.max(1, e.snapMinutes) * 6e4, me = Math.round(be / j) * j, Ae = (Re) => {
          for (let Ee = 0; Ee <= Re; Ee++) {
            const Ke = me - ye * Ee * j, Ce = we(Ke);
            if (b(Ce.start, Ce.end)) return d(Ce.start, Ce.end);
          }
          return null;
        }, he = Ae(Math.ceil(Me / Math.max(1, j / 6e4)) + 1);
        if (he && De) return he;
        const xe = Ae(480);
        if (xe && (!he || !De)) return xe;
        if (he) return he;
        if (xe) return xe;
      }
      const Te = d(y, u);
      return b(Te.start, Te.end) ? Te : null;
    }, U = (y, u, a) => {
      if (!e.canMoveTo) return a;
      const L = Math.max(1, a.end.diff(a.start, "minute")), h = a.start.isAfter(y) ? -1 : 1;
      for (let E = 1; E <= 96; E++) {
        const I = a.start.add(h * E * 15, "minute"), $ = I.add(L, "minute");
        if (b(I, $)) return d(I, $);
      }
      return null;
    }, _ = X(() => i.value ? W(i.value.start) : e.event.start), ee = X(() => i.value ? W(i.value.end) : e.event.end), Z = X(() => {
      const y = e.viewStart.valueOf(), u = (_.value.valueOf() - y) / 6e4 * e.pxPerMin, a = Math.max(16, (ee.value.valueOf() - _.value.valueOf()) / 6e4 * e.pxPerMin);
      let L, h;
      return e.laneStyle ? (L = parseInt(e.laneStyle.top, 10), h = parseInt(e.laneStyle.height, 10)) : (h = Math.max(18, e.rowHeight - 12), L = Math.round((e.rowHeight - h) / 2)), {
        left: `${u}px`,
        width: `${a}px`,
        top: `${L}px`,
        height: `${h}px`,
        background: e.event.color || "linear-gradient(135deg, #3b82f6, #2563eb)",
        border: e.event.border || "none"
      };
    }), se = X(() => {
      const y = Math.round((ee.value.valueOf() - _.value.valueOf()) / 6e4), u = Math.floor(y / 60), a = y % 60;
      return u >= 24 ? `${Math.floor(u / 24)}d ${u % 24}h`.trim() : u > 0 ? `${u}h ${a ? a + "m" : ""}`.trim() : `${a}m`;
    }), te = () => _.value.format("HH:mm") + " – " + ee.value.format("HH:mm"), le = J(null), K = (y) => {
      var h;
      const u = (h = le.value) == null ? void 0 : h.closest(".tl-canvas");
      if (!u) return;
      const a = u.getBoundingClientRect(), L = y - a.left;
      if (L < Xe) {
        const I = (Xe - L) / Xe * ht;
        s("request-autoscroll", { mouseX: y, direction: -1, speed: I, eventId: e.event.id });
      } else if (L > a.width - Xe) {
        const I = (L - (a.width - Xe)) / Xe * ht;
        s("request-autoscroll", { mouseX: y, direction: 1, speed: I, eventId: e.event.id });
      } else
        ge();
    }, ge = (y = !1) => {
      s("request-autoscroll", { mouseX: 0, direction: 0, speed: 0, eventId: e.event.id, clear: y });
    };
    let re = !1, ie = !1, V = null, D = 0, x = null, O = null, A = 0;
    const H = () => {
      if (!re && !ie || !x || !O) return null;
      const u = (A - D + e.dragShiftPx) / e.pxPerMin;
      let a;
      if (re) {
        const L = M(x.add(u, "minute")), h = M(O.add(u, "minute"));
        let E = e.canMoveTo ? b(L, h) ? d(L, h) : Y(x, O, L, h, !0) ?? // ни одна позиция в направлении движения недопустима — остаём на исходной
        (p.value = !0, null) : { start: L, end: h };
        if (!E) return null;
        if (e.canMoveTo && !b(E.start, E.end)) {
          const I = U(x, O, E);
          if (!I)
            return p.value = !0, null;
          E = I;
        }
        p.value = !1, a = { start: E.start, end: E.end };
      } else if (ie && V) {
        const h = M(de((V === "start" ? x : O).valueOf() + u * 6e4)), E = V === "start" ? h : x, I = V === "end" ? h : O;
        let $ = { start: E, end: I };
        if (e.canMoveTo && !b(E, I)) {
          const F = Y(x, O, E, I, !1, V);
          if (F)
            $ = F;
          else {
            p.value = !0;
            const N = i.value ? { start: W(i.value.start), end: W(i.value.end) } : d(x, O);
            return a = V === "start" ? { start: N.start } : { end: N.end }, s("update", a), a;
          }
        }
        p.value = !1, a = V === "start" ? { start: $.start } : { end: $.end };
      } else
        return null;
      return i.value = {
        start: (a.start ?? x).valueOf(),
        end: (a.end ?? O).valueOf()
      }, s("update", a), a;
    };
    _e(() => e.dragShiftPx, () => {
      H();
    });
    let C = null;
    const ue = (y) => {
      if (!c.value) return;
      re = !0, s("drag-state", { active: !0, eventId: e.event.id }), D = y.clientX, A = y.clientX, x = e.event.start, O = e.event.end;
      let u = null;
      const a = (h) => {
        A = h.clientX, u = H() || null, K(h.clientX);
      }, L = () => {
        window.removeEventListener("pointermove", a), window.removeEventListener("pointerup", L), window.removeEventListener("pointercancel", L), C = null, re = !1, s("drag-state", { active: !1, eventId: e.event.id }), ge(!0);
        const h = i.value ? { start: W(i.value.start), end: W(i.value.end) } : null;
        let E = u;
        if (h && (E = re || !V ? { start: h.start, end: h.end } : V === "start" ? { start: h.start } : { end: h.end }), e.canMoveTo) {
          const $ = h ?? (u ? { start: u.start ?? x, end: u.end ?? O } : null);
          if ($ && !b($.start, $.end)) {
            const F = re || !V ? Y(x, O, $.start, $.end, !0) : V === "start" ? Y(x, O, $.start, O, !1, "start") : Y(x, O, x, $.end, !1, "end");
            E = F ? { start: F.start, end: F.end } : null;
          }
        }
        p.value = !1;
        const I = () => {
          i.value = null;
        };
        E ? (s("save", E), dt(I)) : I();
      };
      window.addEventListener("pointermove", a), window.addEventListener("pointerup", L), window.addEventListener("pointercancel", L), C = () => {
        window.removeEventListener("pointermove", a), window.removeEventListener("pointerup", L), window.removeEventListener("pointercancel", L);
      };
    }, Le = (y, u) => {
      if (u.stopImmediatePropagation(), !v.value) return;
      ie = !0, s("drag-state", { active: !0, eventId: e.event.id }), V = y, D = u.clientX, A = u.clientX, x = e.event.start, O = e.event.end;
      let a = null;
      const L = (E) => {
        A = E.clientX, a = H() ?? null, K(E.clientX);
      }, h = () => {
        window.removeEventListener("pointermove", L), window.removeEventListener("pointerup", h), window.removeEventListener("pointercancel", h), C = null, ie = !1, s("drag-state", { active: !1, eventId: e.event.id }), ge(!0);
        const E = V;
        V = null;
        const I = i.value ? { start: W(i.value.start), end: W(i.value.end) } : null;
        let $ = a;
        if (I && ($ = E === "start" ? { start: I.start } : { end: I.end }), e.canMoveTo) {
          const N = I ?? (a ? { start: a.start ?? x, end: a.end ?? O } : null), B = a && a.start !== void 0 && a.end === void 0 ? "start" : a && a.end !== void 0 && a.start === void 0 ? "end" : E;
          if (N && !b(N.start, N.end)) {
            const ae = B === "start" ? Y(x, O, N.start, O, !1, "start") : B === "end" ? Y(x, O, x, N.end, !1, "end") : Y(x, O, N.start, N.end, !0);
            $ = ae ? B === "start" ? { start: ae.start } : B === "end" ? { end: ae.end } : { start: ae.start, end: ae.end } : null;
          }
        }
        p.value = !1;
        const F = () => {
          i.value = null;
        };
        $ ? (s("save", $), dt(F)) : F();
      };
      window.addEventListener("pointermove", L), window.addEventListener("pointerup", h), window.addEventListener("pointercancel", h), C = () => {
        window.removeEventListener("pointermove", L), window.removeEventListener("pointerup", h), window.removeEventListener("pointercancel", h);
      };
    };
    return je(() => {
      C == null || C(), C = null, ge(!0);
    }), (y, u) => (q(), oe("div", {
      class: Ye(["tl-event container", { readonly: !m.value, blocked: p.value }]),
      ref_key: "rootEl",
      ref: le,
      style: $e(Z.value),
      onMouseenter: u[3] || (u[3] = (a) => y.$emit("hover-event", !0)),
      onMouseleave: u[4] || (u[4] = (a) => y.$emit("hover-event", !1)),
      onPointerdown: We(ue, ["stop"]),
      onClick: u[5] || (u[5] = We((a) => y.$emit("click"), ["stop"]))
    }, [
      v.value ? (q(), oe("div", {
        key: 0,
        class: "tl-event-handle left",
        onPointerdown: u[0] || (u[0] = We((a) => Le("start", a), ["stop"]))
      }, null, 32)) : ze("", !0),
      ne("div", an, [
        Ge(y.$slots, "default", {
          event: n.event,
          duration: se.value
        }, () => [
          ne("div", ln, Ie(n.event.title || te()), 1),
          ne("div", un, Ie(se.value), 1)
        ], !0)
      ]),
      v.value ? (q(), oe("div", {
        key: 1,
        class: "tl-event-handle right",
        onPointerdown: u[1] || (u[1] = We((a) => Le("end", a), ["stop"]))
      }, null, 32)) : ze("", !0),
      P.value ? (q(), oe("button", {
        key: 2,
        class: "tl-event-delete",
        onClick: u[2] || (u[2] = We((a) => y.$emit("delete"), ["stop"])),
        title: n.deleteTitle
      }, "×", 8, cn)) : ze("", !0)
    ], 38));
  }
}), Ze = (n, l) => {
  const e = n.__vccOpts || n;
  for (const [s, m] of l)
    e[s] = m;
  return e;
}, fn = /* @__PURE__ */ Ze(dn, [["__scopeId", "data-v-c0280ef0"]]), vn = { class: "tl-tooltip-date" }, mn = /* @__PURE__ */ qe({
  __name: "TimelineTooltip",
  props: {
    tooltip: {},
    minCellMinutes: { default: 15 },
    formattedDate: { default: void 0 },
    locale: { default: void 0 }
  },
  setup(n) {
    const l = n, e = X(() => {
      if (l.formattedDate) return l.formattedDate;
      const s = l.locale ?? "en";
      return l.tooltip.time.locale(s).format(xt);
    });
    return (s, m) => (q(), oe("div", {
      class: "tl-tooltip",
      style: $e({ left: n.tooltip.x + 12 + "px", top: n.tooltip.y + 12 + "px" })
    }, [
      ne("div", vn, Ie(e.value), 1)
    ], 4));
  }
}), hn = /* @__PURE__ */ Ze(mn, [["__scopeId", "data-v-4151a1bc"]]), pn = /* @__PURE__ */ qe({
  __name: "TimelineSelection",
  props: {
    selection: {},
    getX: { type: Function },
    viewStart: {}
  },
  setup(n) {
    const l = n, e = X(() => ({
      left: `${l.getX(l.selection.start)}px`,
      width: `${Math.max(4, l.getX(l.selection.end) - l.getX(l.selection.start))}px`,
      height: "28px"
    }));
    return (s, m) => (q(), oe("div", {
      class: "tl-selection",
      style: $e(e.value)
    }, null, 4));
  }
}), wn = /* @__PURE__ */ Ze(pn, [["__scopeId", "data-v-78234db1"]]), gn = { class: "tl-header" }, Mn = { class: "tl-ruler-wrapper" }, yn = { class: "tl-ruler" }, xn = { class: "tl-ruler-top" }, $n = { class: "tl-mark-label" }, Sn = { class: "tl-ruler-bottom" }, On = { class: "tl-mark-label" }, Dn = { class: "tl-body" }, Tn = ["onMouseenter"], bn = {
  key: 0,
  class: "loading-wrapper"
}, kn = { class: "tl-current-time-label" }, zn = ["onPointerdown", "onMousemove"], En = 4, In = /* @__PURE__ */ qe({
  __name: "Timeline",
  props: {
    events: {},
    resources: {},
    options: { default: () => ({ allowOverlap: !1, minCellMinutes: 15, canCreate: !0, showCurrentTime: !0 }) },
    loading: { type: Boolean, default: !1 },
    rowHeight: { default: 40 },
    locale: { default: void 0 },
    deleteTitle: { default: "Delete" }
  },
  emits: ["create", "update", "save", "delete", "select", "hover", "changeViewport", "change", "update:modelValue"],
  setup(n, { expose: l, emit: e }) {
    const s = n, m = X(() => {
      var r;
      const t = s.locale ?? ((r = s.options) == null ? void 0 : r.locale);
      return t || (typeof navigator < "u" && navigator.language ? navigator.language : "en");
    });
    let P = !1;
    _e(m, async (t) => {
      t.startsWith("ru") && !P && (await import("./ru-v3XlerSb.js").then((r) => r.r), P = !0);
    }, { immediate: !0 });
    const c = e, v = X(() => s.events), i = X(() => s.resources), p = X(() => s.options), {
      viewStart: M,
      viewEnd: b,
      pxPerMin: d,
      zoomLevel: w,
      snap: g,
      addMin: f,
      diffMin: R,
      hasOverlap: Y,
      clampToBounds: U,
      clampDuration: _,
      zoom: ee,
      getX: Z,
      getDateFromX: se,
      containerWidth: te,
      eventsToShow: le,
      minCellMin: K,
      getLaneFor: ge,
      activeDragEventId: re
    } = Qt(v, i, p), ie = (t, r) => {
      const o = s.rowHeight, S = Math.max(16, Math.floor((o - En) / r)), z = r * S, k = Math.max(2, Math.floor((o - z) / 2));
      return { top: k + t * S, height: S, blockBottom: k + z };
    }, V = (t) => {
      let r = 1;
      for (const o of le(t)) {
        const S = ge(t, o.id);
        S && S.lanes > r && (r = S.lanes);
      }
      return r;
    }, D = (t) => {
      const r = s.resources[t];
      if (!r) return s.rowHeight;
      const o = V(r.id);
      if (o <= 1) return s.rowHeight;
      const S = ie(0, o).blockBottom + 4;
      return Math.max(s.rowHeight, S);
    }, x = (t) => ({ height: `${D(t)}px` }), O = (t) => ({ height: `${D(t)}px` }), A = X(() => {
      const t = {};
      for (const r of s.resources)
        for (const o of le(r.id)) {
          const S = ge(r.id, o.id);
          if (S) {
            const z = ie(S.lane, S.lanes);
            t[o.id] = { top: `${z.top}px`, height: `${z.height}px` };
          }
        }
      return t;
    }), H = J(null), C = J(null), ue = X(() => s.options), { isResizing: Le, sidebarRef: y, rulerSpacerRef: u, applySavedWidth: a, onResizePointerDown: L } = on(), h = At({
      visible: !1,
      x: 0,
      y: 0,
      time: de(),
      resourceId: null
    }), E = X(() => h.time), I = Zt(E, m), $ = J(null);
    let F = null, N = null, B = !1, ae = null, Oe = null, we = 0, ye = 0, Pe = 0, be = 0;
    const Me = J(null), De = J(0);
    let Te = null, j = null;
    const me = () => {
      const t = Te ?? j;
      (t !== null || re.value !== null) && (re.value = t);
    }, Ae = (t) => {
      t.active ? (Te = t.eventId, Me.value = t.eventId, me()) : Te === t.eventId && (Te = null, j === t.eventId && (j = null), Me.value === t.eventId && (Me.value = null, De.value = 0), me());
    }, he = J(null), xe = J(null), Re = J(!1), Ee = X(() => {
      if (!xe.value) return null;
      const { absoluteStartMs: t, widthMins: r } = xe.value, S = (t - M.value.valueOf()) / 6e4 * d.value, z = r * d.value + 1;
      return { x: S, width: z };
    }), Ke = (t, r) => {
      var k;
      if (B || Me.value || Re.value) {
        xe.value = null;
        return;
      }
      if (!(r.target instanceof Element)) return;
      const o = (k = r.target.closest(".tl-row")) == null ? void 0 : k.getBoundingClientRect();
      if (!o) return;
      const S = r.clientX - o.left, z = r.clientY - o.top;
      if (z >= 0 && z <= o.height) {
        he.value = t.id;
        const T = K.value, G = Math.floor(M.value.valueOf() / 6e4), ce = S / d.value, pe = G + ce, ke = Math.floor(pe / T) * T;
        xe.value = {
          absoluteStartMs: ke * 6e4,
          widthMins: T
        };
      } else
        he.value = null, xe.value = null;
    }, Ce = () => {
      he.value = null, xe.value = null, Re.value = !1;
    }, { now: Ot, currentTimeX: Ne } = rn(M, d, X(() => !!ue.value.showCurrentTime));
    Ft(() => {
      a(), C.value && new ResizeObserver((r) => {
        for (const o of r)
          te.value = o.contentRect.width;
      }).observe(C.value), c("changeViewport", { start: M.value.clone(), end: b.value.clone() });
    }), je(() => {
      it(), Fe();
    });
    const { topMarks: Dt, bottomMarks: Tt } = tn(M, d, te, m), bt = X(() => {
      if (!s.options.showGrid) return {};
      const t = d.value * 60, r = St(t), o = r * d.value, S = W(M.value), T = -((S.valueOf() / 6e4 + S.utcOffset()) % r * d.value), G = Math.round(o * 100) / 100, ce = Math.round(T * 100) / 100, pe = G < 1 ? G : 1;
      return {
        backgroundImage: `linear-gradient(90deg, var(--border-color) 0 ${pe}px, transparent ${pe}px 100%)`,
        backgroundSize: `${G}px 100%`,
        backgroundPosition: `${ce}px 0`,
        backgroundRepeat: "repeat-x",
        willChange: "background-position"
      };
    }), kt = (t, r, o) => {
      if (!(ye !== 0 && ye !== t) && (ye = t, be = r, Me.value = o, j = o, me(), !Oe)) {
        const S = () => {
          if (ye === 0) {
            Oe = null;
            return;
          }
          const z = be * ye;
          De.value += z;
          const k = z / d.value;
          M.value = f(M.value, k), Oe = requestAnimationFrame(S);
        };
        Oe = requestAnimationFrame(S);
      }
    }, it = (t = !1) => {
      ye = 0, be = 0, t && (j = null, Te === null && (Me.value = null, De.value = 0), me()), Oe && (cancelAnimationFrame(Oe), Oe = null);
    }, zt = (t) => {
      t.direction === 0 ? it(t.clear) : kt(t.direction, t.speed, t.eventId);
    }, Et = (t) => {
      var r;
      if (t.ctrlKey || t.metaKey) {
        t.preventDefault();
        const o = (r = H.value) == null ? void 0 : r.getBoundingClientRect();
        ee(t.deltaY, o ? t.clientX - o.left : void 0);
      } else if (t.shiftKey) {
        t.preventDefault();
        const o = t.deltaY / d.value;
        M.value = f(M.value, o);
      }
    }, fe = /* @__PURE__ */ new Map();
    let Qe = 0, Je = 0;
    _e(() => [M.value, b.value], ([t, r], [o, S]) => {
      o.valueOf() === t.valueOf() && S.valueOf() === r.valueOf() || c("changeViewport", { start: t.clone(), end: r.clone() });
    });
    const It = (t) => {
      if (fe.set(t.pointerId, t), fe.size >= 2) {
        B = !1, $.value = null;
        const r = Array.from(fe.values());
        Qe = Math.hypot(
          r[0].clientX - r[1].clientX,
          r[0].clientY - r[1].clientY
        ), Je = (r[0].clientX + r[1].clientX) / 2;
      } else fe.size === 1 && t.pointerType === "touch" && !B && !Me.value && et(t);
    }, Lt = (t) => {
      var r;
      if (fe.set(t.pointerId, t), fe.size === 2) {
        t.preventDefault();
        const o = Array.from(fe.values()), S = Math.hypot(
          o[0].clientX - o[1].clientX,
          o[0].clientY - o[1].clientY
        ), z = (o[0].clientX + o[1].clientX) / 2, k = S - Qe;
        if (Math.abs(k) > 1) {
          const G = (r = H.value) == null ? void 0 : r.getBoundingClientRect(), ce = G ? z - G.left : void 0;
          ee(-k * 3, ce), Qe = S;
        }
        const T = z - Je;
        if (Math.abs(T) > 1) {
          const G = -T / d.value;
          M.value = f(M.value, G), Je = z;
        }
      } else fe.size === 1 && !B && !Me.value && et(t);
    }, lt = (t) => {
      fe.delete(t.pointerId), fe.size === 0 && t.pointerType === "touch" && setTimeout(() => {
        fe.size === 0 && (h.visible = !1);
      }, 2e3);
    }, et = (t) => {
      if (!H.value) return;
      const r = H.value.getBoundingClientRect(), o = t.clientX - r.left, S = t.clientY - r.top, z = se(o);
      let k = -1;
      {
        let G = 0;
        for (let ce = 0; ce < s.resources.length; ce++) {
          const pe = D(ce);
          if (S < G + pe) {
            k = ce;
            break;
          }
          G += pe;
        }
      }
      const T = k >= 0 ? s.resources[k] : null;
      h.visible = !0, h.x = o, h.y = S, h.time = g(z), h.resourceId = (T == null ? void 0 : T.id) ?? null, c("hover", { time: z, resourceId: (T == null ? void 0 : T.id) ?? null });
    }, ut = (t, r) => {
      if (we !== 0 && we !== t && Fe(), we = t, Pe = r, !ae) {
        const o = () => {
          var k;
          if (we === 0 || !B || !F) {
            ae = null;
            return;
          }
          const z = Pe * we / d.value;
          if (M.value = f(M.value, z), $.value) {
            const T = Z(F), G = (k = H.value) == null ? void 0 : k.getBoundingClientRect();
            if (G) {
              const ce = we > 0 ? G.width - 20 : 20, pe = g(se(Math.min(T, ce))), ke = g(se(Math.max(T, ce))), Ve = R(ke, pe) < K.value ? f(pe, K.value) : ke;
              $.value = { resourceId: N, start: pe, end: Ve };
            }
          }
          ae = requestAnimationFrame(o);
        };
        ae = requestAnimationFrame(o);
      }
    }, Fe = () => {
      we = 0, Pe = 0, ae && (cancelAnimationFrame(ae), ae = null);
    }, Pt = (t, r) => {
      if (ue.value.canCreate === !1 || r.target.closest(".tl-event") || (fe.set(r.pointerId, r), r.pointerType === "touch" && fe.size > 1))
        return;
      const o = H.value.getBoundingClientRect();
      F = g(se(r.clientX - o.left)), N = t.id, B = !0, $.value = {
        resourceId: t.id,
        start: F,
        end: f(F, K.value)
      };
      const S = (k) => {
        if (!B || fe.size >= 2) {
          B = !1, $.value = null, Fe();
          return;
        }
        const T = k.clientX - o.left, G = 50, ce = 10;
        T < G ? ut(-1, ce * (1 - T / G)) : T > o.width - G ? ut(1, ce * (1 - (o.width - T) / G)) : Fe();
        const pe = Z(F), ke = g(se(Math.min(pe, T))), Ve = g(se(Math.max(pe, T))), _t = R(Ve, ke) < K.value ? f(ke, K.value) : Ve;
        $.value = { resourceId: t.id, start: ke, end: _t }, et(k);
      }, z = () => {
        if (window.removeEventListener("pointermove", S), window.removeEventListener("pointerup", z), window.removeEventListener("pointercancel", z), fe.delete(r.pointerId), Fe(), $.value && B) {
          const k = U($.value.start, $.value.end), { start: T, end: G } = _(k.start, k.end);
          Y(t.id, T, G) || c("create", { event: { start: T, end: G, resourceId: t.id } });
        }
        $.value = null, B = !1, F = null;
      };
      window.addEventListener("pointermove", S, { passive: !1 }), window.addEventListener("pointerup", z), window.addEventListener("pointercancel", z);
    }, tt = (t) => {
      c("change", { events: t }), c("update:modelValue", t);
    }, ct = (t, r) => {
      const o = r.start ?? t.start, S = r.end ?? t.end;
      return s.events.map((z) => z.id === t.id ? { ...z, start: o, end: S } : z);
    }, Rt = (t, r) => {
      if (t.canEdit === !1 || ue.value.canEdit === !1) return;
      const o = st(t, r), S = U(o.start, o.end), z = _(S.start, S.end), k = z.start, T = z.end;
      Y(t.resourceId, k, T, t.id) || (c("update", { event: t, changes: { start: k, end: T } }), tt(ct(t, { start: k, end: T })));
    }, Ct = (t, r) => {
      if (t.canEdit === !1 || ue.value.canEdit === !1) return;
      const o = st(t, r), S = U(o.start, o.end), z = _(S.start, S.end), k = z.start, T = z.end;
      Y(t.resourceId, k, T, t.id) || (c("save", { event: t, changes: { start: k, end: T } }), tt(ct(t, { start: k, end: T })));
    }, Ht = (t) => {
      c("delete", { event: t }), tt(s.events.filter((r) => r.id !== t.id));
    }, Xt = (t, r, o) => !Y(t.resourceId, r, o, t.id), Yt = (t, r) => {
      const o = Math.max(0, ue.value.snapMinutes ?? 0) * 6e4;
      if (o <= 0) return { start: t, end: r };
      const S = (z) => de(Math.round(z.valueOf() / o) * o);
      return { start: S(t), end: S(r) };
    };
    return l({
      __setView: (t, r) => {
        M.value = t, r && (d.value = r);
      },
      // Ширина контейнера в jsdom всегда 0/NaN → viewEnd = viewStart + NaN и
      // viewport-фильтр не срабатывает вовсе. Тестам нужно управляемое окно.
      __setContainerWidth: (t) => {
        te.value = t;
      },
      __activeDragEventId: () => re.value,
      __clearActiveDragEventId: () => {
        re.value = null;
      },
      // Эмуляция начала/конца drag-жеста для событий, которых НЕТ в DOM (вне окна):
      // реальный TimelineEvent на pointerdown эмитит ровно такой же 'drag-state'.
      __emitDragState: (t) => Ae(t)
    }), (t, r) => (q(), oe("div", {
      class: "tl-root",
      style: $e({ "--tl-row-height": n.rowHeight + "px" })
    }, [
      ne("div", gn, [
        Ge(t.$slots, "header", {
          viewStart: Q(M),
          zoomLevel: Q(w)
        }, void 0, !0)
      ]),
      ne("div", Mn, [
        ne("div", {
          class: "tl-ruler-spacer",
          ref_key: "rulerSpacerRef",
          ref: u
        }, null, 512),
        ne("div", yn, [
          ne("div", xn, [
            (q(!0), oe(Ue, null, Be(Q(Dt), (o) => (q(), oe("div", {
              key: "t" + o.time,
              class: Ye(["tl-mark", [o.type, { sticky: o.sticky }]]),
              style: $e({ left: o.x + "px", width: o.width + "px" })
            }, [
              ne("div", $n, Ie(o.label), 1)
            ], 6))), 128))
          ]),
          ne("div", Sn, [
            (q(!0), oe(Ue, null, Be(Q(Tt), (o) => (q(), oe("div", {
              key: "b" + o.time,
              class: Ye(["tl-mark tl-mark-bottom", [o.type, { sticky: o.sticky }]]),
              style: $e({ left: o.x + "px", width: o.width + "px" })
            }, [
              ne("div", On, Ie(o.label), 1)
            ], 6))), 128))
          ])
        ])
      ]),
      ne("div", Dn, [
        ne("div", {
          class: "tl-sidebar",
          ref_key: "sidebarRef",
          ref: y
        }, [
          (q(!0), oe(Ue, null, Be(n.resources, (o, S) => (q(), oe("div", {
            key: o.id,
            class: Ye(["tl-sidebar-item", { "is-hovered": he.value === o.id }]),
            style: $e(O(S)),
            onMouseenter: (z) => he.value = o.id,
            onMouseleave: r[0] || (r[0] = (z) => he.value = null)
          }, [
            Ge(t.$slots, "sidebar-item", { resource: o }, () => [
              ft(Ie(o.title), 1)
            ], !0)
          ], 46, Tn))), 128)),
          ne("div", {
            class: Ye(["tl-sidebar-resizer", { "is-resizing": Q(Le) }]),
            onPointerdown: r[1] || (r[1] = //@ts-ignore
            (...o) => Q(L) && Q(L)(...o))
          }, [...r[4] || (r[4] = [
            ne("div", { class: "content" }, null, -1)
          ])], 34)
        ], 512),
        n.loading ? (q(), oe("div", bn, [
          Ge(t.$slots, "loading", {}, () => [
            r[5] || (r[5] = ft("Loading...", -1))
          ], !0)
        ])) : ze("", !0),
        ne("div", {
          class: "tl-canvas-wrapper",
          ref_key: "canvasWrapperRef",
          ref: C
        }, [
          ne("div", {
            class: "tl-canvas",
            ref_key: "canvasRef",
            ref: H,
            style: $e(bt.value),
            onWheel: Et,
            onPointerdown: It,
            onPointermove: Lt,
            onPointerup: lt,
            onPointercancel: lt,
            onMouseleave: r[3] || (r[3] = (o) => h.visible = !1)
          }, [
            ue.value.showCurrentTime && Q(Ne) !== null && Q(Ne) >= -10 && Q(Ne) <= Q(te) + 10 ? (q(), oe("div", {
              key: 0,
              class: "tl-current-time-line",
              style: $e({ left: Q(Ne) + "px" })
            }, [
              ne("div", kn, Ie(Q(Ot).format("HH:mm")), 1)
            ], 4)) : ze("", !0),
            (q(!0), oe(Ue, null, Be(n.resources, (o, S) => {
              var z;
              return q(), oe("div", {
                key: o.id,
                class: Ye(["tl-row", { "is-hovered": he.value === o.id }]),
                style: $e(x(S)),
                onPointerdown: (k) => Pt(o, k),
                onMousemove: (k) => Ke(o, k),
                onMouseleave: Ce
              }, [
                (q(!0), oe(Ue, null, Be(Q(le)(o.id), (k) => (q(), nt(fn, {
                  key: k.id,
                  event: k,
                  "view-start": Q(M),
                  "px-per-min": Q(d),
                  "can-edit-global": ue.value.canEdit !== !1,
                  "can-delete-global": ue.value.canDelete !== !1,
                  "canvas-width": Q(te),
                  "drag-shift-px": Me.value === k.id ? De.value : 0,
                  "delete-title": n.deleteTitle,
                  "row-height": n.rowHeight,
                  "lane-style": A.value[k.id],
                  "can-move-to": (T, G) => Xt(k, T, G),
                  "normalize-position": Yt,
                  "snap-minutes": Q(K),
                  onUpdate: (T) => Rt(k, T),
                  onSave: (T) => Ct(k, T),
                  onDragState: Ae,
                  onDelete: (T) => Ht(k),
                  onClick: (T) => c("select", { event: k }),
                  onRequestAutoscroll: zt,
                  onHoverEvent: r[2] || (r[2] = (T) => Re.value = T)
                }, {
                  default: Wt((T) => [
                    Ge(t.$slots, "event", Ut({ ref_for: !0 }, T), void 0, !0)
                  ]),
                  _: 3
                }, 8, ["event", "view-start", "px-per-min", "can-edit-global", "can-delete-global", "canvas-width", "drag-shift-px", "delete-title", "row-height", "lane-style", "can-move-to", "snap-minutes", "onUpdate", "onSave", "onDelete", "onClick"]))), 128)),
                ((z = $.value) == null ? void 0 : z.resourceId) === o.id ? (q(), nt(wn, {
                  key: 0,
                  selection: $.value,
                  "get-x": Q(Z),
                  "view-start": Q(M)
                }, null, 8, ["selection", "get-x", "view-start"])) : ze("", !0),
                Ee.value && he.value === o.id && !Re.value ? (q(), oe("div", {
                  key: 1,
                  class: "cell-hover-highlight",
                  style: $e({ left: Ee.value.x + "px", width: Ee.value.width + "px" })
                }, [...r[6] || (r[6] = [
                  ne("span", { class: "plus-icon" }, "+", -1)
                ])], 4)) : ze("", !0)
              ], 46, zn);
            }), 128)),
            h.visible ? (q(), nt(hn, {
              key: 1,
              tooltip: h,
              "formatted-date": Q(I)
            }, null, 8, ["tooltip", "formatted-date"])) : ze("", !0)
          ], 36)
        ], 512)
      ])
    ], 4));
  }
}), Yn = /* @__PURE__ */ Ze(In, [["__scopeId", "data-v-3b7c1c12"]]);
export {
  Yn as T,
  xt as a,
  Kt as b,
  rt as c,
  de as d,
  Rn as g,
  Xn as l,
  $t as n,
  Hn as p,
  vt as s,
  Cn as t,
  Zt as u
};
