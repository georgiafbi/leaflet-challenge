"""CLI runner for Leaflet Challenge Mother Brain & Specialist Swarm."""
from __future__ import annotations

import argparse
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.mother_brain.supervisor import LeafletChallengeMotherBrain


def cmd_diagnose(args: argparse.Namespace) -> None:
    brain = LeafletChallengeMotherBrain(PROJECT_ROOT)
    print("=" * 80)
    print(" LEAFLET CHALLENGE: MOTHER BRAIN & SPECIALIST SWARM DIAGNOSIS")
    print(f" Root: {PROJECT_ROOT}")
    print("=" * 80)

    synthesis = brain.run_investigation()
    print(f"\nOverall Health: {synthesis.overall_health:.2f} / 1.00\n")

    for res in synthesis.specialist_results:
        status_tag = f"[{res.status:7s}]"
        print(f"{status_tag} {res.role} ({res.agent_id})")
        for finding in res.findings:
            print(f"  * {finding}")
        if res.recommendations:
            for rec in res.recommendations:
                print(f"    --> Recommendation: {rec}")
        print()

    print("=" * 80)
    print(" ACTIONABLE RECOMMENDATIONS")
    print("=" * 80)
    if synthesis.recommendations:
        for idx, rec in enumerate(synthesis.recommendations, 1):
            print(f"  {idx}. {rec}")
    else:
        print("  [OK] No issues detected.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Leaflet Challenge Swarm Diagnostics")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("diagnose", help="Run full Mother Brain & Swarm diagnosis")

    args = parser.parse_args()
    if args.command == "diagnose":
        cmd_diagnose(args)


if __name__ == "__main__":
    main()
