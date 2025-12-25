#!/usr/bin/env python3
"""
Comprehensive Test Runner for Cloud Sync System
Runs all test suites and generates consolidated reports
"""

import asyncio
import subprocess
import sys
import time
import json
import argparse
from pathlib import Path
from typing import Dict, List, Any
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ComprehensiveTestRunner:
    """Main test runner for all test suites"""

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.test_results = {}
        self.start_time = time.time()

    async def run_all_tests(self, test_types: List[str] = None) -> Dict[str, Any]:
        """Run all specified test suites"""
        logger.info("Starting comprehensive test run")

        if test_types is None:
            test_types = [
                "unit", "integration", "deployment", "ux", "accessibility",
                "performance", "security", "openspec", "e2e"
            ]

        test_runners = {
            "unit": self.run_unit_tests,
            "integration": self.run_integration_tests,
            "deployment": self.run_deployment_tests,
            "ux": self.run_ux_tests,
            "accessibility": self.run_accessibility_tests,
            "performance": self.run_performance_tests,
            "security": self.run_security_tests,
            "openspec": self.run_openspec_validation,
            "e2e": self.run_e2e_tests
        }

        results = {}

        for test_type in test_types:
            if test_type in test_runners:
                logger.info(f"Running {test_type} tests...")
                try:
                    result = await test_runners[test_type]()
                    results[test_type] = result
                except Exception as e:
                    logger.error(f"Failed to run {test_type} tests: {e}")
                    results[test_type] = {
                        "status": "FAILED",
                        "error": str(e),
                        "duration": 0
                    }
            else:
                logger.warning(f"Unknown test type: {test_type}")

        # Generate consolidated report
        await self.generate_consolidated_report(results)

        return results

    async def run_unit_tests(self) -> Dict[str, Any]:
        """Run unit test suite"""
        start_time = time.time()

        try:
            cmd = [
                sys.executable, "-m", "pytest",
                "tests/unit/",
                "--cov=src",
                "--cov-report=json",
                "--cov-report=html",
                "--junitxml=unit-test-results.xml",
                "-v"
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self.project_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            # Read coverage report
            coverage_data = {}
            try:
                with open(self.project_root / "coverage.json") as f:
                    coverage_data = json.load(f)
            except FileNotFoundError:
                logger.warning("Coverage report not found")

            return {
                "status": "PASSED" if process.returncode == 0 else "FAILED",
                "return_code": process.returncode,
                "duration": time.time() - start_time,
                "coverage": coverage_data.get("totals", {}),
                "stdout": stdout.decode(),
                "stderr": stderr.decode()
            }

        except Exception as e:
            return {
                "status": "FAILED",
                "error": str(e),
                "duration": time.time() - start_time
            }

    async def run_integration_tests(self) -> Dict[str, Any]:
        """Run integration test suite"""
        start_time = time.time()

        try:
            cmd = [
                sys.executable, "-m", "pytest",
                "tests/integration/",
                "--junitxml=integration-test-results.xml",
                "-v",
                "--timeout=300"
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self.project_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            return {
                "status": "PASSED" if process.returncode == 0 else "FAILED",
                "return_code": process.returncode,
                "duration": time.time() - start_time,
                "stdout": stdout.decode(),
                "stderr": stderr.decode()
            }

        except Exception as e:
            return {
                "status": "FAILED",
                "error": str(e),
                "duration": time.time() - start_time
            }

    async def run_deployment_tests(self) -> Dict[str, Any]:
        """Run deployment test suite"""
        start_time = time.time()

        try:
            cmd = [str(self.project_root / "scripts" / "deployment-test.sh")]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self.project_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            return {
                "status": "PASSED" if process.returncode == 0 else "FAILED",
                "return_code": process.returncode,
                "duration": time.time() - start_time,
                "stdout": stdout.decode(),
                "stderr": stderr.decode()
            }

        except Exception as e:
            return {
                "status": "FAILED",
                "error": str(e),
                "duration": time.time() - start_time
            }

    async def run_ux_tests(self) -> Dict[str, Any]:
        """Run UX test framework"""
        start_time = time.time()

        try:
            cmd = [sys.executable, str(self.project_root / "tests" / "ux_test_framework.py")]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self.project_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            return {
                "status": "PASSED" if process.returncode == 0 else "FAILED",
                "return_code": process.returncode,
                "duration": time.time() - start_time,
                "stdout": stdout.decode(),
                "stderr": stderr.decode()
            }

        except Exception as e:
            return {
                "status": "FAILED",
                "error": str(e),
                "duration": time.time() - start_time
            }

    async def run_accessibility_tests(self) -> Dict[str, Any]:
        """Run accessibility tests"""
        start_time = time.time()

        try:
            # Import and run UX framework accessibility tests
            sys.path.append(str(self.project_root / "tests"))
            from ux_test_framework import UXTestFramework

            framework = UXTestFramework()
            await framework.initialize()
            accessibility_results = await framework.run_accessibility_tests()
            await framework.cleanup()

            failed_tests = sum(1 for r in accessibility_results if not r.get("passed", False))

            return {
                "status": "PASSED" if failed_tests == 0 else "FAILED",
                "total_tests": len(accessibility_results),
                "failed_tests": failed_tests,
                "duration": time.time() - start_time,
                "results": accessibility_results
            }

        except Exception as e:
            return {
                "status": "FAILED",
                "error": str(e),
                "duration": time.time() - start_time
            }

    async def run_performance_tests(self) -> Dict[str, Any]:
        """Run performance tests"""
        start_time = time.time()

        try:
            cmd = [
                sys.executable, "-m", "pytest",
                "tests/performance/",
                "--benchmark-only",
                "--benchmark-json=benchmark-results.json"
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self.project_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            benchmark_data = {}
            try:
                with open(self.project_root / "benchmark-results.json") as f:
                    benchmark_data = json.load(f)
            except FileNotFoundError:
                logger.warning("Benchmark results not found")

            return {
                "status": "PASSED" if process.returncode == 0 else "FAILED",
                "return_code": process.returncode,
                "duration": time.time() - start_time,
                "benchmark_data": benchmark_data,
                "stdout": stdout.decode(),
                "stderr": stderr.decode()
            }

        except Exception as e:
            return {
                "status": "FAILED",
                "error": str(e),
                "duration": time.time() - start_time
            }

    async def run_security_tests(self) -> Dict[str, Any]:
        """Run security tests"""
        start_time = time.time()

        try:
            # Run bandit security scan
            bandit_cmd = [
                sys.executable, "-m", "bandit",
                "-r", "src/",
                "-f", "json",
                "-o", "bandit-report.json"
            ]

            bandit_process = await asyncio.create_subprocess_exec(
                *bandit_cmd,
                cwd=self.project_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            bandit_stdout, bandit_stderr = await bandit_process.communicate()

            # Run safety dependency check
            safety_cmd = [
                sys.executable, "-m", "safety",
                "check",
                "--json",
                "--output", "safety-report.json"
            ]

            safety_process = await asyncio.create_subprocess_exec(
                *safety_cmd,
                cwd=self.project_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            safety_stdout, safety_stderr = await safety_process.communicate()

            # Read security reports
            bandit_data = {}
            safety_data = {}
            try:
                with open(self.project_root / "bandit-report.json") as f:
                    bandit_data = json.load(f)
            except FileNotFoundError:
                pass

            try:
                with open(self.project_root / "safety-report.json") as f:
                    safety_data = json.load(f)
            except FileNotFoundError:
                pass

            total_issues = len(bandit_data.get("results", [])) + len(safety_data.get("vulnerabilities", []))
            high_severity = len([
                r for r in bandit_data.get("results", [])
                if r.get("issue_severity") == "HIGH"
            ])

            return {
                "status": "PASSED" if high_severity == 0 else "FAILED",
                "total_issues": total_issues,
                "high_severity": high_severity,
                "duration": time.time() - start_time,
                "bandit_results": bandit_data,
                "safety_results": safety_data
            }

        except Exception as e:
            return {
                "status": "FAILED",
                "error": str(e),
                "duration": time.time() - start_time
            }

    async def run_openspec_validation(self) -> Dict[str, Any]:
        """Run OpenSpec validation"""
        start_time = time.time()

        try:
            cmd = [
                sys.executable,
                str(self.project_root / "tests" / "openspec_validator.py"),
                str(self.project_root)
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self.project_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            return {
                "status": "PASSED" if process.returncode == 0 else "FAILED",
                "return_code": process.returncode,
                "duration": time.time() - start_time,
                "stdout": stdout.decode(),
                "stderr": stderr.decode()
            }

        except Exception as e:
            return {
                "status": "FAILED",
                "error": str(e),
                "duration": time.time() - start_time
            }

    async def run_e2e_tests(self) -> Dict[str, Any]:
        """Run end-to-end tests"""
        start_time = time.time()

        try:
            # Run Playwright E2E tests
            cmd = [
                "npx", "playwright", "test",
                "tests/e2e/",
                "--reporter=json",
                "--output-file=e2e-results.json"
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self.project_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            e2e_data = {}
            try:
                with open(self.project_root / "e2e-results.json") as f:
                    e2e_data = json.load(f)
            except FileNotFoundError:
                logger.warning("E2E results not found")

            return {
                "status": "PASSED" if process.returncode == 0 else "FAILED",
                "return_code": process.returncode,
                "duration": time.time() - start_time,
                "e2e_data": e2e_data,
                "stdout": stdout.decode(),
                "stderr": stderr.decode()
            }

        except Exception as e:
            return {
                "status": "FAILED",
                "error": str(e),
                "duration": time.time() - start_time
            }

    async def generate_consolidated_report(self, results: Dict[str, Any]):
        """Generate consolidated test report"""
        logger.info("Generating consolidated test report")

        total_duration = time.time() - self.start_time
        total_tests = len(results)
        passed_tests = sum(1 for r in results.values() if r.get("status") == "PASSED")
        failed_tests = total_tests - passed_tests

        # Calculate metrics
        metrics = {
            "total_duration": total_duration,
            "total_test_suites": total_tests,
            "passed_suites": passed_tests,
            "failed_suites": failed_tests,
            "success_rate": passed_tests / total_tests if total_tests > 0 else 0,
        }

        # Add specific metrics from each test type
        if "unit" in results and "coverage" in results["unit"]:
            metrics["code_coverage"] = results["unit"]["coverage"].get("percent_covered", 0)

        if "security" in results:
            metrics["security_issues"] = results["security"].get("total_issues", 0)
            metrics["high_severity_issues"] = results["security"].get("high_severity", 0)

        if "performance" in results and "benchmark_data" in results["performance"]:
            benchmarks = results["performance"]["benchmark_data"].get("benchmarks", [])
            if benchmarks:
                metrics["performance_benchmarks"] = len(benchmarks)

        # Generate HTML report
        await self._generate_html_report(results, metrics)

        # Generate JSON report
        report_data = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "project_root": str(self.project_root),
            "metrics": metrics,
            "results": results
        }

        report_path = self.project_root / "test-results" / "comprehensive-test-report.json"
        report_path.parent.mkdir(exist_ok=True)

        with open(report_path, "w") as f:
            json.dump(report_data, f, indent=2, default=str)

        # Generate Markdown summary
        await self._generate_markdown_summary(results, metrics)

        logger.info(f"Test reports generated in {report_path.parent}")

    async def _generate_html_report(self, results: Dict[str, Any], metrics: Dict[str, Any]):
        """Generate HTML consolidated report"""
        html_template = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloud Sync System - Comprehensive Test Report</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f7fa;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }}
        .metrics {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8fafc;
        }}
        .metric {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .metric-value {{
            font-size: 2em;
            font-weight: bold;
            color: #4F46E5;
        }}
        .metric-label {{
            color: #64748b;
            margin-top: 5px;
        }}
        .results {{
            padding: 30px;
        }}
        .test-result {{
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 20px;
            overflow: hidden;
        }}
        .test-header {{
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e2e8f0;
        }}
        .test-name {{
            font-weight: 600;
            font-size: 1.1em;
        }}
        .status {{
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        }}
        .status-passed {{
            background: #dcfce7;
            color: #15803d;
        }}
        .status-failed {{
            background: #fee2e2;
            color: #dc2626;
        }}
        .test-details {{
            padding: 20px;
        }}
        .duration {{
            color: #64748b;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Cloud Sync System</h1>
            <h2>Comprehensive Test Report</h2>
            <p>Generated on {time.strftime("%Y-%m-%d %H:%M:%S")}</p>
        </div>

        <div class="metrics">
            <div class="metric">
                <div class="metric-value">{metrics.get('success_rate', 0):.1%}</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">{metrics.get('total_test_suites', 0)}</div>
                <div class="metric-label">Test Suites</div>
            </div>
            <div class="metric">
                <div class="metric-value">{metrics.get('passed_suites', 0)}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value">{metrics.get('total_duration', 0):.1f}s</div>
                <div class="metric-label">Total Duration</div>
            </div>
            {f'''<div class="metric">
                <div class="metric-value">{metrics.get('code_coverage', 0):.1f}%</div>
                <div class="metric-label">Code Coverage</div>
            </div>''' if 'code_coverage' in metrics else ''}
            {f'''<div class="metric">
                <div class="metric-value">{metrics.get('security_issues', 0)}</div>
                <div class="metric-label">Security Issues</div>
            </div>''' if 'security_issues' in metrics else ''}
        </div>

        <div class="results">
            <h2>Test Results</h2>
            {self._generate_test_results_html(results)}
        </div>
    </div>
</body>
</html>
"""

        report_path = self.project_root / "test-results" / "comprehensive-test-report.html"
        report_path.parent.mkdir(exist_ok=True)

        with open(report_path, "w") as f:
            f.write(html_template)

    def _generate_test_results_html(self, results: Dict[str, Any]) -> str:
        """Generate HTML for test results"""
        html = ""

        for test_name, result in results.items():
            status_class = f"status-{result.get('status', 'unknown').lower()}"
            duration = result.get('duration', 0)

            html += f"""
            <div class="test-result">
                <div class="test-header">
                    <div class="test-name">{test_name.replace('_', ' ').title()}</div>
                    <div class="status {status_class}">{result.get('status', 'UNKNOWN')}</div>
                </div>
                <div class="test-details">
                    <div class="duration">Duration: {duration:.2f}s</div>
                    {f'<div>Return Code: {result.get("return_code", "N/A")}</div>' if 'return_code' in result else ''}
                    {f'<div>Coverage: {result["coverage"].get("percent_covered", 0):.1f}%</div>' if 'coverage' in result else ''}
                    {f'<div>Security Issues: {result.get("total_issues", 0)}</div>' if 'total_issues' in result else ''}
                    {f'<div>Error: {result.get("error", "")}</div>' if 'error' in result else ''}
                </div>
            </div>
            """

        return html

    async def _generate_markdown_summary(self, results: Dict[str, Any], metrics: Dict[str, Any]):
        """Generate Markdown summary"""
        summary = f"""
# Cloud Sync System - Test Summary

## Overall Results

- **Success Rate**: {metrics.get('success_rate', 0):.1%}
- **Test Suites**: {metrics.get('total_test_suites', 0)}
- **Passed**: {metrics.get('passed_suites', 0)}
- **Failed**: {metrics.get('failed_suites', 0)}
- **Total Duration**: {metrics.get('total_duration', 0):.1f}s

## Individual Test Results

"""

        for test_name, result in results.items():
            status = result.get('status', 'UNKNOWN')
            duration = result.get('duration', 0)
            emoji = "✅" if status == "PASSED" else "❌"

            summary += f"- {emoji} **{test_name.replace('_', ' ').title()}**: {status} ({duration:.2f}s)\n"

        if 'code_coverage' in metrics:
            summary += f"\n- **Code Coverage**: {metrics['code_coverage']:.1f}%\n"

        if 'security_issues' in metrics:
            summary += f"- **Security Issues**: {metrics['security_issues']} ({metrics.get('high_severity_issues', 0)} high severity)\n"

        summary += f"\n*Generated on {time.strftime("%Y-%m-%d %H:%M:%S")}*"

        summary_path = self.project_root / "test-results" / "test-summary.md"
        with open(summary_path, "w") as f:
            f.write(summary)


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Run comprehensive test suite")
    parser.add_argument(
        "--test-types",
        nargs="+",
        choices=["unit", "integration", "deployment", "ux", "accessibility", "performance", "security", "openspec", "e2e"],
        help="Test types to run (default: all)"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path.cwd(),
        help="Project root directory"
    )

    args = parser.parse_args()

    runner = ComprehensiveTestRunner(args.project_root)
    results = await runner.run_all_tests(args.test_types)

    # Determine exit code
    failed_tests = sum(1 for r in results.values() if r.get("status") != "PASSED")
    exit_code = 1 if failed_tests > 0 else 0

    print(f"\nTest Summary:")
    print(f"Total: {len(results)}")
    print(f"Passed: {len(results) - failed_tests}")
    print(f"Failed: {failed_tests}")

    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())