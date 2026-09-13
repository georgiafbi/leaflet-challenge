"""Mother Brain Supervisor for Leaflet Challenge."""
from __future__ import annotations

from pathlib import Path
from typing import List
from ..protocols.messages import DiagnosticSynthesis, SpecialistResult
from ..swarm.agents import GeoJsonSpecialist, LeafletVisualizationSpecialist, WebHygieneCritic


class LeafletChallengeMotherBrain:
    """Executive supervisor arbitrating GeoJSON data, visual mapping, and web hygiene."""

    def __init__(self, project_root: Path) -> None:
        self.project_root = Path(project_root).resolve()
        self.geo_specialist = GeoJsonSpecialist(self.project_root)
        self.vis_specialist = LeafletVisualizationSpecialist(self.project_root)
        self.critic = WebHygieneCritic(self.project_root)

    def run_investigation(self) -> DiagnosticSynthesis:
        results: List[SpecialistResult] = [
            self.geo_specialist.analyze(),
            self.vis_specialist.analyze(),
            self.critic.analyze(),
        ]

        recommendations = []
        score = 1.0

        for r in results:
            if r.status == "FAILED":
                score -= 0.3
            elif r.status == "WARNING":
                score -= 0.1
            recommendations.extend(r.recommendations)

        return DiagnosticSynthesis(
            overall_health=max(0.0, min(1.0, score)),
            specialist_results=results,
            recommendations=recommendations,
        )

    def auto_sync(self, commit_message: Optional[str] = None) -> str:
        """Stage, commit, and push any local changes autonomously."""
        import subprocess
        from datetime import datetime, timezone
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        p_str = str(self.project_root)

        res_status = subprocess.run(["git", "-C", p_str, "status", "--porcelain"], capture_output=True, text=True)
        has_changes = bool(res_status.stdout.strip())
        res_sb = subprocess.run(["git", "-C", p_str, "status", "-sb"], capture_output=True, text=True)
        header = res_sb.stdout.splitlines()[0] if res_sb.stdout else ""
        is_ahead = "ahead" in header
        is_behind = "behind" in header

        if not has_changes and not is_ahead and not is_behind:
            return "Clean & In Sync"

        if is_behind:
            subprocess.run(["git", "-C", p_str, "pull", "--rebase", "origin", "HEAD"], capture_output=True)

        if has_changes:
            subprocess.run(["git", "-C", p_str, "add", "-A"], check=True)
            msg = commit_message or f"chore(autonomous-sync): leaflet-challenge updates [{now_str}]"
            subprocess.run(["git", "-C", p_str, "commit", "-m", msg], capture_output=True)

        res_push = subprocess.run(["git", "-C", p_str, "push", "origin", "HEAD"], capture_output=True, text=True)
        if res_push.returncode == 0:
            return "Synchronized & Pushed to GitHub"
        return f"Push Failed: {res_push.stderr.strip()[:100]}"
