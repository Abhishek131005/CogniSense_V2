"""
================================================================================
 CogniSense — Oculomotor Diagnostic Module
 ReportGenerator - Clinical summary and visualisation
================================================================================
"""

import json
import math
import time
from pathlib import Path
from typing import List
import numpy as np
import matplotlib
matplotlib.use("Agg")          # headless-safe backend
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

from ..config import (
    FIXATION_DURATION_S, RESPONSE_WINDOW_S, SACCADE_VELOCITY_DEG_S,
    SUMMARY_JSON, PLOT_PATH
)
from ..data.data_containers import GazePoint, TrialResult


class ReportGenerator:
    """
    Aggregates trial results into:
      • JSON clinical summary
      • matplotlib gaze-path visualisation (best + worst trial)
    """

    # ── risk stratification ───────────────────────────────────────────────
    @staticmethod
    def _risk(error_rate: float, mean_latency: float,
              mean_rmsd: float, pursuit_gain: float) -> str:
        """
        Simple deterministic rule-based risk classifier.
        (In production this feeds into the CogniSense fusion model.)

        Thresholds derived from published literature:
          - Error rate  > 40% → elevated risk  [Crawford et al., 2002]
          - Latency     > 350ms               [Shafiq-Antonacci et al.]
          - RMSD        > 0.12                (clinical heuristic)
          - Pursuit gain < 0.7                (Lisberger, 1998)
        """
        risk_score = 0
        if error_rate  > 40:  risk_score += 2
        elif error_rate > 20: risk_score += 1
        if not math.isnan(mean_latency):
            if mean_latency  > 350: risk_score += 2
            elif mean_latency > 250: risk_score += 1
        if not math.isnan(mean_rmsd):
            if mean_rmsd  > 0.12: risk_score += 1
        if not math.isnan(pursuit_gain):
            if pursuit_gain < 0.7:  risk_score += 2
            elif pursuit_gain < 0.85: risk_score += 1

        if risk_score >= 5: return "High"
        if risk_score >= 3: return "Medium"
        return "Low"

    # ── console + JSON summary ─────────────────────────────────────────────
    def generate_summary(self, results: List[TrialResult],
                         pursuit_gain: float) -> dict:
        n_trials     = len(results)
        n_errors     = sum(1 for r in results if r.is_error)
        error_rate   = 100 * n_errors / max(n_trials, 1)

        latencies    = [r.latency_ms for r in results
                        if not r.is_error and not math.isnan(r.latency_ms)]
        mean_latency = float(np.mean(latencies)) if latencies else float("nan")

        rmsds        = [r.fixation_rmsd for r in results
                        if not math.isnan(r.fixation_rmsd)]
        mean_rmsd    = float(np.mean(rmsds)) if rmsds else float("nan")

        risk         = self._risk(error_rate, mean_latency,
                                  mean_rmsd, pursuit_gain)

        report = {
            "n_trials"          : n_trials,
            "n_errors"          : n_errors,
            "error_rate"        : f"{error_rate:.1f}%",
            "avg_latency_ms"    : f"{mean_latency:.1f}" if not math.isnan(mean_latency)
                                  else "N/A",
            "stability_score"   : f"{mean_rmsd:.4f}" if not math.isnan(mean_rmsd)
                                  else "N/A",
            "pursuit_gain"      : f"{pursuit_gain:.3f}" if not math.isnan(pursuit_gain)
                                  else "N/A",
            "clinical_risk"     : risk,
            "timestamp_utc"     : time.strftime("%Y-%m-%dT%H:%M:%SZ",
                                                time.gmtime()),
        }

        # ── console print ─────────────────────────────────────────────────
        sep = "═" * 55
        print(f"\n{sep}")
        print("  CogniSense — OCULOMOTOR ASSESSMENT REPORT")
        print(sep)
        print(f"  Trials completed    : {n_trials}")
        print(f"  Antisaccade errors  : {n_errors}  ({error_rate:.1f}%)")
        print(f"  Mean correct latency: {report['avg_latency_ms']} ms")
        print(f"  Fixation stability  : RMSD = {report['stability_score']}")
        print(f"  Smooth pursuit gain : {report['pursuit_gain']}")
        print(f"  ─────────────────────────────────────────────────")
        col = {"Low": "\033[92m", "Medium": "\033[93m",
               "High": "\033[91m"}.get(risk, "")
        rst = "\033[0m"
        print(f"  Clinical Risk Flag  : {col}{risk}{rst}")
        print(sep)

        return report

    def save_json(self, report: dict, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(report, f, indent=2)
        print(f"[INFO] JSON report    → {path}")

    # ── matplotlib gaze-path plots ─────────────────────────────────────────
    def plot_gaze_paths(self, results: List[TrialResult],
                        all_points: List[GazePoint],
                        path: Path):
        if not results:
            return

        # Find best (no error, lowest latency) and worst (error + highest rmsd)
        no_errors = [r for r in results if not r.is_error
                     and not math.isnan(r.latency_ms)]
        errors    = [r for r in results if r.is_error]

        best_trial = min(no_errors, key=lambda r: r.latency_ms,
                         default=results[0])
        worst_trial = max(errors, key=lambda r: r.fixation_rmsd,
                          default=results[-1])

        def get_pts(tid: int) -> List[GazePoint]:
            return [p for p in all_points
                    if p.trial_id == tid and p.face_detected
                    and not math.isnan(p.norm_x)]

        fig = plt.figure(figsize=(16, 9), facecolor="#111111")
        gs  = gridspec.GridSpec(2, 3, figure=fig,
                                wspace=0.35, hspace=0.45)

        # ── helper ────────────────────────────────────────────────────────
        def _plot_path(ax, pts: List[GazePoint], title: str, colour: str):
            if not pts:
                ax.text(0.5, 0.5, "No valid data", ha="center", va="center",
                        transform=ax.transAxes, color="white")
                return
            xs  = [p.norm_x for p in pts]
            ys  = [p.norm_y for p in pts]
            ts  = np.linspace(0, 1, len(xs))
            sc  = ax.scatter(xs, ys, c=ts, cmap="plasma",
                             s=15, alpha=0.8, zorder=3)
            ax.plot(xs, ys, color=colour, alpha=0.4, linewidth=1, zorder=2)
            # start / end markers
            ax.scatter([xs[0]],  [ys[0]],  color="lime",   s=80, zorder=5,
                       label="Start")
            ax.scatter([xs[-1]], [ys[-1]], color="red",    s=80, zorder=5,
                       label="End")
            ax.axhline(0, color="#444", linewidth=0.7)
            ax.axvline(0, color="#444", linewidth=0.7)
            ax.set_xlim(-1, 1)
            ax.set_ylim(-1, 1)
            ax.set_title(title, color="white", fontsize=10, pad=6)
            ax.set_xlabel("Normalised Gaze X", color="#aaa", fontsize=8)
            ax.set_ylabel("Normalised Gaze Y", color="#aaa", fontsize=8)
            ax.set_facecolor("#1a1a2e")
            ax.tick_params(colors="#888")
            for spine in ax.spines.values():
                spine.set_edgecolor("#444")
            ax.legend(fontsize=7, labelcolor="white",
                      facecolor="#222", edgecolor="#555")
            plt.colorbar(sc, ax=ax, label="Time →").ax.yaxis.label.set_color(
                "#aaa")

        # ── time-series gaze-x ────────────────────────────────────────────
        def _plot_timeseries(ax, pts: List[GazePoint], trial: TrialResult,
                             colour: str):
            if not pts:
                return
            t0  = pts[0].timestamp_s
            ts  = [(p.timestamp_s - t0) * 1000 for p in pts]
            xs  = [p.norm_x for p in pts]

            # shade fixation vs stimulus
            fix_end = FIXATION_DURATION_S * 1000
            ax.axvspan(0, fix_end, alpha=0.12, color="cyan",
                       label="Fixation")
            ax.axvspan(fix_end,
                       (FIXATION_DURATION_S + RESPONSE_WINDOW_S) * 1000,
                       alpha=0.07, color="yellow", label="Response")
            ax.plot(ts, xs, color=colour, linewidth=1.2, alpha=0.9)
            ax.axhline(0, color="#444", linewidth=0.7)

            # Stimulus direction marker
            stim_y = 0.8 if trial.stimulus_side == "right" else -0.8
            ax.annotate(f"Stim→{trial.stimulus_side}",
                        xy=(fix_end, stim_y), fontsize=7,
                        color="orange", xycoords="data")

            ax.set_title(
                f"Trial {trial.trial_id} — Gaze X vs Time\n"
                f"({'ERROR' if trial.is_error else f'Latency {trial.latency_ms:.0f}ms'})",
                color="white", fontsize=9, pad=4)
            ax.set_xlabel("Time (ms)", color="#aaa", fontsize=8)
            ax.set_ylabel("Norm Gaze X", color="#aaa", fontsize=8)
            ax.set_facecolor("#1a1a2e")
            ax.tick_params(colors="#888")
            for spine in ax.spines.values():
                spine.set_edgecolor("#444")
            ax.legend(fontsize=7, labelcolor="white",
                      facecolor="#222", edgecolor="#555")

        # ── velocity histogram ────────────────────────────────────────────
        def _plot_velocity_hist(ax, results: List[TrialResult]):
            vels = [r.first_velocity for r in results if r.first_velocity > 0]
            if not vels:
                return
            ax.hist(vels, bins=10, color="#5588ff", edgecolor="#222",
                    alpha=0.85)
            ax.axvline(SACCADE_VELOCITY_DEG_S, color="red",
                       linewidth=1.5, linestyle="--",
                       label=f"Threshold {SACCADE_VELOCITY_DEG_S}°/s")
            ax.set_title("First Saccade Velocity Distribution",
                         color="white", fontsize=9, pad=4)
            ax.set_xlabel("Velocity (°/s)", color="#aaa", fontsize=8)
            ax.set_ylabel("Count",         color="#aaa", fontsize=8)
            ax.set_facecolor("#1a1a2e")
            ax.tick_params(colors="#888")
            for spine in ax.spines.values():
                spine.set_edgecolor("#444")
            ax.legend(fontsize=7, labelcolor="white",
                      facecolor="#222", edgecolor="#555")

        # ── error timeline ────────────────────────────────────────────────
        def _plot_error_timeline(ax, results: List[TrialResult]):
            tids  = [r.trial_id for r in results]
            errs  = [1 if r.is_error else 0 for r in results]
            cols  = ["#e53935" if e else "#43a047" for e in errs]
            ax.bar(tids, errs, color=cols, edgecolor="#111", width=0.7)
            ax.set_title("Error Timeline per Trial",
                         color="white", fontsize=9, pad=4)
            ax.set_xlabel("Trial ID",    color="#aaa", fontsize=8)
            ax.set_ylabel("Error (1=Yes)", color="#aaa", fontsize=8)
            ax.set_ylim(-0.1, 1.4)
            ax.set_facecolor("#1a1a2e")
            ax.tick_params(colors="#888")
            for spine in ax.spines.values():
                spine.set_edgecolor("#444")

        # ── RMSD per trial ────────────────────────────────────────────────
        def _plot_rmsd(ax, results: List[TrialResult]):
            tids  = [r.trial_id for r in results]
            rmsds = [r.fixation_rmsd if not math.isnan(r.fixation_rmsd) else 0
                     for r in results]
            ax.plot(tids, rmsds, "o-", color="#ffab40",
                    linewidth=1.5, markersize=5)
            ax.axhline(0.12, color="red", linewidth=1.2, linestyle="--",
                       label="Risk threshold 0.12")
            ax.set_title("Fixation RMSD per Trial",
                         color="white", fontsize=9, pad=4)
            ax.set_xlabel("Trial ID",    color="#aaa", fontsize=8)
            ax.set_ylabel("RMSD",        color="#aaa", fontsize=8)
            ax.set_facecolor("#1a1a2e")
            ax.tick_params(colors="#888")
            for spine in ax.spines.values():
                spine.set_edgecolor("#444")
            ax.legend(fontsize=7, labelcolor="white",
                      facecolor="#222", edgecolor="#555")

        # ── draw panels ────────────────────────────────────────────────────
        best_pts  = get_pts(best_trial.trial_id)
        worst_pts = get_pts(worst_trial.trial_id)

        _plot_path(fig.add_subplot(gs[0, 0]), best_pts,
                   f"Gaze Path — Best Trial #{best_trial.trial_id}", "#4fc3f7")
        _plot_path(fig.add_subplot(gs[1, 0]), worst_pts,
                   f"Gaze Path — Worst Trial #{worst_trial.trial_id}", "#ef9a9a")
        _plot_timeseries(fig.add_subplot(gs[0, 1]), best_pts,
                         best_trial, "#4fc3f7")
        _plot_timeseries(fig.add_subplot(gs[1, 1]), worst_pts,
                         worst_trial, "#ef9a9a")
        _plot_velocity_hist(fig.add_subplot(gs[0, 2]), results)
        _plot_error_timeline(fig.add_subplot(gs[1, 2]), results)

        fig.suptitle("CogniSense — Oculomotor Biomarker Dashboard",
                     color="white", fontsize=14, y=0.98)

        path.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(path, dpi=150, bbox_inches="tight",
                    facecolor=fig.get_facecolor())
        plt.close(fig)
        print(f"[INFO] Gaze-path plot → {path}")