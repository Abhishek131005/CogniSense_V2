"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 ReportGenerator — clinical summary, 0-100 score, 6-class label
================================================================================
"""

import json
import math
import time
from pathlib import Path
from typing import List
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

from ..config import SUMMARY_JSON, PLOT_PATH, SACCADE_VELOCITY_DEG_S
from ..data.data_containers import GazePoint, TrialResult, SessionResult
from .biomarker_engine import BiomarkerEngine


class ReportGenerator:

    # ── per-trial serialisation ───────────────────────────────────────────
    @staticmethod
    def _trial_to_dict(r: TrialResult) -> dict:
        """Compact, JSON-safe view of a single antisaccade trial."""
        def _fmt(v, nd=1, na="N/A"):
            if v is None:
                return na
            if isinstance(v, float) and math.isnan(v):
                return na
            return round(float(v), nd) if isinstance(v, (int, float)) else v

        return {
            "trial_id"         : r.trial_id,
            "stimulus_side"    : r.stimulus_side,
            "correct_side"     : r.correct_side,
            "response"         : r.response_label,     # correct | error | no_response
            "is_error"         : bool(r.is_error),
            "first_saccade_dir": r.first_saccade_dir,  # left | right | none
            "latency_ms"       : _fmt(r.latency_ms, 1),
            "first_velocity"   : _fmt(r.first_velocity, 1),
            "fixation_rmsd"    : _fmt(r.fixation_rmsd, 4),
            "frames_collected" : int(r.frames_collected),
            "head_moved"       : bool(r.head_moved),
        }

    # ── aggregate + score ─────────────────────────────────────────────────
    def build_session(self, results: List[TrialResult],
                      pursuit_gain: float) -> SessionResult:
        n_trials = len(results)
        n_errors = sum(1 for r in results if r.is_error)
        n_no_resp = sum(1 for r in results if r.response_label == "no_response")
        error_rate = 100.0 * n_errors / max(n_trials, 1)

        latencies = [r.latency_ms for r in results
                     if not r.is_error and not math.isnan(r.latency_ms)]
        mean_latency = float(np.mean(latencies)) if latencies else float("nan")

        rmsds = [r.fixation_rmsd for r in results
                 if not math.isnan(r.fixation_rmsd)]
        mean_rmsd = float(np.mean(rmsds)) if rmsds else float("nan")

        score, label, conf = BiomarkerEngine.score_and_classify(
            error_rate, mean_latency, mean_rmsd, pursuit_gain)

        return SessionResult(
            n_trials         = n_trials,
            n_errors         = n_errors,
            n_no_response    = n_no_resp,
            error_rate       = error_rate,
            mean_latency_ms  = mean_latency,
            mean_rmsd        = mean_rmsd,
            pursuit_gain     = pursuit_gain,
            score            = score,
            class_label      = label,
            class_confidence = conf,
            trial_results    = list(results),
        )

    # ── console + JSON ────────────────────────────────────────────────────
    def generate_summary(self, session: SessionResult) -> dict:
        """
        Build the report dict. Contains:
          • header fields (aggregate biomarkers, score, class)
          • per-trial array (mirrors the console print)
        """
        # ── per-trial ────────────────────────────────────────────────────
        trials_block = [self._trial_to_dict(r) for r in session.trial_results]

        # ── summary ──────────────────────────────────────────────────────
        report = {
            "header": {
                "module"       : "CogniSense Oculomotor Diagnostic Module",
                "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ",
                                               time.gmtime()),
                "n_trials"     : session.n_trials,
            },
            "aggregate": {
                "n_errors"        : session.n_errors,
                "n_no_response"   : session.n_no_response,
                "error_rate"      : f"{session.error_rate:.1f}%",
                "avg_latency_ms"  : (f"{session.mean_latency_ms:.1f}"
                                     if not math.isnan(session.mean_latency_ms)
                                     else "N/A"),
                "stability_rmsd"  : (f"{session.mean_rmsd:.4f}"
                                     if not math.isnan(session.mean_rmsd)
                                     else "N/A"),
                "pursuit_gain"    : (f"{session.pursuit_gain:.3f}"
                                     if not math.isnan(session.pursuit_gain)
                                     else "N/A"),
            },
            "score": {
                "value"      : round(session.score, 1),
                "scale"      : "0-100 (higher = healthier)",
                "class_label": session.class_label,
                "confidence" : round(session.class_confidence, 2),
                "class_bands": [
                    {"label": "Optimal",           "range": [85, 100]},
                    {"label": "Normal",            "range": [70, 85]},
                    {"label": "Borderline",        "range": [55, 70]},
                    {"label": "Mild Concern",      "range": [40, 55]},
                    {"label": "Moderate Concern",  "range": [25, 40]},
                    {"label": "High Concern",      "range": [0,  25]},
                ],
            },
            "trials": trials_block,
        }

        # ── console print ────────────────────────────────────────────────
        sep = "═" * 60
        print(f"\n{sep}")
        print("  CogniSense — OCULOMOTOR ASSESSMENT REPORT")
        print(sep)
        print(f"  Trials completed      : {session.n_trials}")
        print(f"  Antisaccade errors    : {session.n_errors}  "
              f"({session.error_rate:.1f}%)")
        print(f"  No-response trials    : {session.n_no_response}")
        print(f"  Mean correct latency  : {report['aggregate']['avg_latency_ms']} ms")
        print(f"  Fixation stability    : RMSD = "
              f"{report['aggregate']['stability_rmsd']}")
        print(f"  Smooth pursuit gain   : {report['aggregate']['pursuit_gain']}")
        print(f"  ─────────────────────────────────────────────────")
        print(f"  FINAL SCORE           : {report['score']['value']} / 100")
        print(f"  CLASSIFICATION        : {session.class_label} "
              f"(confidence {report['score']['confidence']})")
        print(sep)
        print("  PER-TRIAL BREAKDOWN")
        print(sep)

        for t in trials_block:
            lat = t["latency_ms"]
            lat_str = f"{lat:6.1f}ms" if isinstance(lat, (int, float)) else "   N/A "
            rmsd = t["fixation_rmsd"]
            rmsd_str = f"{rmsd:6.4f}" if isinstance(rmsd, (int, float)) else "   N/A"

            print(f"  Trial {t['trial_id']:2d} | "
                  f"stim={t['stimulus_side']:5s} | "
                  f"{t['response']:11s} | "
                  f"first={t['first_saccade_dir']:5s} | "
                  f"latency={lat_str} | "
                  f"rmsd={rmsd_str} | "
                  f"head_moved={t['head_moved']}")
        print(sep)

        return report

    def save_json(self, report: dict, path: Path = SUMMARY_JSON):
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(report, f, indent=2)
        print(f"[INFO] JSON report    → {path}")

    # ── gaze-path plots ───────────────────────────────────────────────────
    def plot_gaze_paths(self, session: SessionResult,
                        all_points: List[GazePoint],
                        path: Path = PLOT_PATH):
        results = session.trial_results
        if not results:
            return

        no_errors = [r for r in results if not r.is_error
                     and not math.isnan(r.latency_ms)]
        errors    = [r for r in results if r.is_error]

        best_trial  = min(no_errors, key=lambda r: r.latency_ms,
                          default=results[0])
        worst_trial = max(errors, key=lambda r: r.fixation_rmsd,
                          default=results[-1])

        def get_pts(tid: int) -> List[GazePoint]:
            return [p for p in all_points
                    if p.trial_id == tid and p.face_detected
                    and not math.isnan(p.norm_x)]

        fig = plt.figure(figsize=(15, 8), facecolor="#111111")
        gs  = gridspec.GridSpec(2, 2, figure=fig, wspace=0.3, hspace=0.4)

        def _plot_path(ax, pts, title, colour):
            if not pts:
                ax.text(0.5, 0.5, "No valid data", ha="center", va="center",
                        transform=ax.transAxes, color="white")
                return
            xs = [p.norm_x for p in pts]
            ys = [p.norm_y for p in pts]
            ts = np.linspace(0, 1, len(xs))
            sc = ax.scatter(xs, ys, c=ts, cmap="plasma", s=15, alpha=0.8,
                            zorder=3)
            ax.plot(xs, ys, color=colour, alpha=0.4, linewidth=1, zorder=2)
            ax.scatter([xs[0]], [ys[0]], color="lime", s=80, zorder=5,
                       label="Start")
            ax.scatter([xs[-1]], [ys[-1]], color="red", s=80, zorder=5,
                       label="End")
            ax.axhline(0, color="#444", linewidth=0.7)
            ax.axvline(0, color="#444", linewidth=0.7)
            ax.set_xlim(-1, 1); ax.set_ylim(-1, 1)
            ax.set_title(title, color="white", fontsize=10, pad=6)
            ax.set_xlabel("Norm Gaze X", color="#aaa", fontsize=8)
            ax.set_ylabel("Norm Gaze Y", color="#aaa", fontsize=8)
            ax.set_facecolor("#1a1a2e")
            ax.tick_params(colors="#888")
            for sp in ax.spines.values():
                sp.set_edgecolor("#444")
            ax.legend(fontsize=7, labelcolor="white",
                      facecolor="#222", edgecolor="#555")
            plt.colorbar(sc, ax=ax, label="Time →").ax.yaxis.label.set_color(
                "#aaa")

        def _plot_timeseries(ax, pts, trial, colour):
            if not pts:
                return
            t0 = pts[0].timestamp_s
            ts = [(p.timestamp_s - t0) * 1000 for p in pts]
            xs = [p.norm_x for p in pts]
            ax.plot(ts, xs, color=colour, linewidth=1.2, alpha=0.9)
            ax.axhline(0, color="#444", linewidth=0.7)
            outcome = trial.response_label.upper()
            ax.set_title(f"Trial {trial.trial_id} — Gaze X vs Time  ({outcome})",
                         color="white", fontsize=9, pad=4)
            ax.set_xlabel("Time (ms)", color="#aaa", fontsize=8)
            ax.set_ylabel("Norm Gaze X", color="#aaa", fontsize=8)
            ax.set_facecolor("#1a1a2e")
            ax.tick_params(colors="#888")
            for sp in ax.spines.values():
                sp.set_edgecolor("#444")

        def _plot_error_timeline(ax, results):
            tids = [r.trial_id for r in results]
            errs = [1 if r.is_error else 0 for r in results]
            cols = ["#e53935" if e else "#43a047" for e in errs]
            ax.bar(tids, errs, color=cols, edgecolor="#111", width=0.7)
            ax.set_title("Error Timeline per Trial", color="white",
                         fontsize=9, pad=4)
            ax.set_xlabel("Trial ID", color="#aaa", fontsize=8)
            ax.set_ylabel("Error (1=Yes)", color="#aaa", fontsize=8)
            ax.set_ylim(-0.1, 1.4)
            ax.set_facecolor("#1a1a2e")
            ax.tick_params(colors="#888")
            for sp in ax.spines.values():
                sp.set_edgecolor("#444")

        best_pts  = get_pts(best_trial.trial_id)
        worst_pts = get_pts(worst_trial.trial_id)

        _plot_path(fig.add_subplot(gs[0, 0]), best_pts,
                   f"Gaze Path — Best Trial #{best_trial.trial_id}", "#4fc3f7")
        _plot_timeseries(fig.add_subplot(gs[0, 1]), best_pts,
                         best_trial, "#4fc3f7")
        _plot_path(fig.add_subplot(gs[1, 0]), worst_pts,
                   f"Gaze Path — Worst Trial #{worst_trial.trial_id}", "#ef9a9a")
        _plot_error_timeline(fig.add_subplot(gs[1, 1]), results)

        fig.suptitle(
            f"CogniSense — Score {session.score:.0f}/100  ·  "
            f"{session.class_label}",
            color="white", fontsize=14, y=0.98)

        path.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(path, dpi=150, bbox_inches="tight",
                    facecolor=fig.get_facecolor())
        plt.close(fig)
        print(f"[INFO] Dashboard plot → {path}")