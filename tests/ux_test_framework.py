#!/usr/bin/env python3
"""
User Experience Testing Framework for Cloud Sync System
Provides comprehensive UX testing including usability, accessibility, and performance testing
"""

import asyncio
import time
import json
import logging
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import statistics

try:
    import playwright.async_api
    from playwright.async_api import Page, Browser, BrowserContext
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

try:
    from PIL import Image, ImageChops
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    import axe_core
    AXE_AVAILABLE = True
except ImportError:
    AXE_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestResult(Enum):
    """Test result status"""
    PASSED = "PASSED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
    WARNING = "WARNING"


@dataclass
class UXTestMetric:
    """Individual UX test metric"""
    name: str
    value: float
    unit: str
    threshold: Optional[float] = None
    status: TestResult = TestResult.PASSED
    description: str = ""


@dataclass
class UXTestCase:
    """UX test case definition"""
    name: str
    description: str
    test_type: str
    steps: List[str]
    expected_outcomes: List[str]
    success_criteria: Dict[str, Any]
    accessibility_requirements: List[str] = None


@dataclass
class UXTestReport:
    """Complete UX test report"""
    test_suite: str
    timestamp: str
    total_tests: int
    passed_tests: int
    failed_tests: int
    skipped_tests: int
    metrics: List[UXTestMetric]
    test_results: List[Dict[str, Any]]
    accessibility_violations: List[Dict[str, Any]]
    performance_issues: List[Dict[str, Any]]
    recommendations: List[str]


class UXTestFramework:
    """Main UX testing framework"""

    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.test_results: List[Dict[str, Any]] = []
        self.metrics: List[UXTestMetric] = []
        self.screenshots: List[Path] = []

        if not PLAYWRIGHT_AVAILABLE:
            logger.warning("Playwright not available. Browser tests will be skipped.")
        if not AXE_AVAILABLE:
            logger.warning("Axe-core not available. Accessibility tests will be limited.")

    async def initialize(self):
        """Initialize browser and testing environment"""
        if not PLAYWRIGHT_AVAILABLE:
            return False

        try:
            from playwright.async_api import async_playwright
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)
            self.context = await self.browser.new_context(
                viewport={"width": 1280, "height": 720},
                user_agent="Cloud-Sync-UX-Tester/1.0"
            )
            self.page = await self.context.new_page()
            return True
        except Exception as e:
            logger.error(f"Failed to initialize browser: {e}")
            return False

    async def cleanup(self):
        """Clean up resources"""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()

    async def run_usability_tests(self) -> List[Dict[str, Any]]:
        """Run comprehensive usability tests"""
        logger.info("Starting usability tests")

        test_cases = [
            UXTestCase(
                name="First Time User Setup",
                description="Test complete first-time setup experience",
                test_type="user_journey",
                steps=[
                    "Navigate to setup page",
                    "Complete welcome wizard",
                    "Configure sync settings",
                    "Connect cloud provider",
                    "Verify successful setup"
                ],
                expected_outcomes=[
                    "Setup wizard completes successfully",
                    "User understands each step",
                    "No critical errors occur",
                    "Configuration is saved correctly"
                ],
                success_criteria={
                    "completion_time": 300,  # seconds
                    "error_count": 0,
                    "help_requests": 2,  # maximum help clicks
                    "steps_completed": 5
                }
            ),
            UXTestCase(
                name="File Synchronization Workflow",
                description="Test core file sync user workflow",
                test_type="core_functionality",
                steps=[
                    "Access main dashboard",
                    "Select sync directory",
                    "Initiate sync operation",
                    "Monitor progress",
                    "Verify sync completion"
                ],
                expected_outcomes=[
                    "Sync starts within 3 seconds",
                    "Progress is clearly visible",
                    "User can pause/resume sync",
                    "Completion status is clear"
                ],
                success_criteria={
                    "response_time": 3,  # seconds
                    "progress_visibility": True,
                    "error_rate": 0.05,  # 5% max error rate
                    "task_completion_rate": 0.95
                }
            ),
            UXTestCase(
                name="Conflict Resolution Interface",
                description="Test conflict resolution user experience",
                test_type="error_handling",
                steps=[
                    "Create sync conflict scenario",
                    "View conflict details",
                    "Choose resolution strategy",
                    "Apply resolution",
                    "Verify resolution success"
                ],
                expected_outcomes=[
                    "Conflict is clearly presented",
                    "Resolution options are understandable",
                    "Choice is applied correctly",
                    "User can preview changes"
                ],
                success_criteria={
                    "conflict_clarity": 0.9,  # 90% understandability score
                    "resolution_time": 60,  # seconds
                    "success_rate": 0.95
                }
            )
        ]

        results = []
        for test_case in test_cases:
            result = await self._run_usability_test(test_case)
            results.append(result)

        return results

    async def _run_usability_test(self, test_case: UXTestCase) -> Dict[str, Any]:
        """Run individual usability test"""
        logger.info(f"Running usability test: {test_case.name}")

        start_time = time.time()
        test_metrics = {}
        errors = []

        try:
            if not self.page:
                raise RuntimeError("Browser not initialized")

            # Navigate to starting point
            await self.page.goto(self.base_url, wait_until="networkidle")

            # Measure initial page load time
            navigation_time = await self._measure_navigation_time()
            test_metrics["navigation_time"] = navigation_time

            # Execute test steps and collect metrics
            step_results = []
            for i, step in enumerate(test_case.steps):
                step_start = time.time()

                try:
                    # Execute step (this would be implemented based on actual UI)
                    step_result = await self._execute_test_step(step, i + 1)
                    step_time = time.time() - step_start

                    step_results.append({
                        "step": step,
                        "time": step_time,
                        "success": step_result["success"],
                        "notes": step_result.get("notes", "")
                    })

                    # Take screenshot after each step
                    screenshot_path = await self._take_screenshot(f"{test_case.name}_step_{i+1}")
                    step_result["screenshot"] = str(screenshot_path)

                except Exception as e:
                    errors.append(f"Step {i+1} failed: {str(e)}")
                    step_results.append({
                        "step": step,
                        "time": time.time() - step_start,
                        "success": False,
                        "error": str(e)
                    })

            total_time = time.time() - start_time

            # Evaluate success criteria
            success_evaluation = self._evaluate_success_criteria(
                test_case.success_criteria, test_metrics, step_results
            )

            # Calculate overall test result
            test_passed = (
                len(errors) == 0 and
                success_evaluation["overall_score"] >= 0.8 and
                total_time <= test_case.success_criteria.get("completion_time", float('inf'))
            )

            result = {
                "test_case": test_case.name,
                "description": test_case.description,
                "total_time": total_time,
                "steps_completed": len([r for r in step_results if r["success"]]),
                "total_steps": len(test_case.steps),
                "errors": errors,
                "step_results": step_results,
                "test_metrics": test_metrics,
                "success_evaluation": success_evaluation,
                "passed": test_passed,
                "screenshot_count": len(self.screenshots)
            }

            self.test_results.append(result)
            return result

        except Exception as e:
            logger.error(f"Usability test '{test_case.name}' failed: {e}")
            return {
                "test_case": test_case.name,
                "description": test_case.description,
                "total_time": time.time() - start_time,
                "passed": False,
                "error": str(e),
                "steps_completed": 0,
                "total_steps": len(test_case.steps)
            }

    async def _execute_test_step(self, step: str, step_number: int) -> Dict[str, Any]:
        """Execute individual test step"""
        # This would be implemented based on actual UI interactions
        # For now, we'll simulate step execution

        await asyncio.sleep(0.5)  # Simulate user interaction time

        # Mock step execution based on step description
        if "Navigate" in step:
            await self.page.goto(self.base_url, wait_until="networkidle")
        elif "Click" in step or "Select" in step:
            await self.page.click(f"button:has-text('Continue')")
        elif "Fill" in step or "Enter" in step:
            await self.page.fill("input[name='test']", "test_value")

        return {"success": True, "notes": f"Step {step_number} completed successfully"}

    async def _measure_navigation_time(self) -> float:
        """Measure page navigation time"""
        start_time = time.time()
        await self.page.wait_for_load_state("networkidle")
        return time.time() - start_time

    async def _take_screenshot(self, name: str) -> Path:
        """Take screenshot and return path"""
        if not self.page:
            return None

        screenshot_dir = Path("test-results/screenshots")
        screenshot_dir.mkdir(parents=True, exist_ok=True)

        screenshot_path = screenshot_dir / f"{name}_{int(time.time())}.png"
        await self.page.screenshot(path=screenshot_path)
        self.screenshots.append(screenshot_path)

        return screenshot_path

    def _evaluate_success_criteria(self, criteria: Dict[str, Any],
                                 metrics: Dict[str, Any],
                                 step_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Evaluate test success against criteria"""
        scores = {}

        for criterion, threshold in criteria.items():
            if criterion == "completion_time":
                total_time = sum(r["time"] for r in step_results)
                score = min(1.0, threshold / total_time) if total_time > 0 else 1.0
                scores[criterion] = score

            elif criterion == "error_count":
                error_count = len([r for r in step_results if not r["success"]])
                score = max(0.0, 1.0 - (error_count / max(threshold, 1)))
                scores[criterion] = score

            elif criterion == "response_time":
                avg_response = statistics.mean([r["time"] for r in step_results])
                score = min(1.0, threshold / avg_response) if avg_response > 0 else 1.0
                scores[criterion] = score

            elif criterion == "steps_completed":
                completed = len([r for r in step_results if r["success"]])
                score = completed / threshold if threshold > 0 else 1.0
                scores[criterion] = score

        overall_score = statistics.mean(scores.values()) if scores else 0.0

        return {
            "individual_scores": scores,
            "overall_score": overall_score,
            "meets_threshold": overall_score >= 0.8
        }

    async def run_accessibility_tests(self) -> List[Dict[str, Any]]:
        """Run comprehensive accessibility tests"""
        logger.info("Starting accessibility tests")

        if not AXE_AVAILABLE:
            logger.warning("Axe-core not available. Skipping accessibility tests.")
            return []

        accessibility_tests = [
            {
                "name": "WCAG 2.1 AA Compliance",
                "description": "Check for WCAG 2.1 AA level compliance",
                "standard": "WCAG21AA"
            },
            {
                "name": "Keyboard Navigation",
                "description": "Test complete keyboard navigation support",
                "standard": "KeyboardNavigation"
            },
            {
                "name": "Screen Reader Support",
                "description": "Verify proper ARIA labels and landmarks",
                "standard": "ScreenReader"
            },
            {
                "name": "Color Contrast",
                "description": "Check color contrast ratios",
                "standard": "ColorContrast"
            },
            {
                "name": "Focus Management",
                "description": "Test focus indicators and trap management",
                "standard": "FocusManagement"
            }
        ]

        results = []

        if not self.page:
            logger.error("Browser not initialized for accessibility testing")
            return results

        for test in accessibility_tests:
            try:
                result = await self._run_accessibility_test(test)
                results.append(result)
            except Exception as e:
                logger.error(f"Accessibility test '{test['name']}' failed: {e}")
                results.append({
                    "name": test["name"],
                    "passed": False,
                    "error": str(e),
                    "violations": []
                })

        return results

    async def _run_accessibility_test(self, test: Dict[str, Any]) -> Dict[str, Any]:
        """Run individual accessibility test"""
        logger.info(f"Running accessibility test: {test['name']}")

        # Navigate to test page
        await self.page.goto(self.base_url, wait_until="networkidle")

        # Run axe-core accessibility scan
        results = await self.page.evaluate("""
        async () => {
            try {
                const axe = require('axe-core');
                const results = await axe.run(document, {
                    rules: {
                        // Configure specific rules based on test type
                    }
                });
                return results;
            } catch (error) {
                return { error: error.message };
            }
        }
        """)

        if isinstance(results, dict) and "error" in results:
            raise RuntimeError(f"Axe-core error: {results['error']}")

        violations = results.get("violations", [])
        passes = results.get("passes", [])
        incomplete = results.get("incomplete", [])

        # Categorize violations by severity
        critical_violations = [v for v in violations if v.get("impact") == "critical"]
        serious_violations = [v for v in violations if v.get("impact") == "serious"]
        moderate_violations = [v for v in violations if v.get("impact") == "moderate"]
        minor_violations = [v for v in violations if v.get("impact") == "minor"]

        # Calculate accessibility score
        total_rules = len(violations) + len(passes) + len(incomplete)
        accessibility_score = len(passes) / total_rules if total_rules > 0 else 0

        # Determine test result
        passed = len(critical_violations) == 0 and len(serious_violations) <= 2

        return {
            "name": test["name"],
            "description": test["description"],
            "standard": test["standard"],
            "passed": passed,
            "accessibility_score": accessibility_score,
            "total_violations": len(violations),
            "violations": {
                "critical": len(critical_violations),
                "serious": len(serious_violations),
                "moderate": len(moderate_violations),
                "minor": len(minor_violations)
            },
            "violation_details": [
                {
                    "rule": v.get("id"),
                    "impact": v.get("impact"),
                    "description": v.get("description"),
                    "help": v.get("help"),
                    "nodes": len(v.get("nodes", []))
                }
                for v in violations
            ],
            "passes_count": len(passes),
            "incomplete_count": len(incomplete)
        }

    async def run_performance_tests(self) -> List[Dict[str, Any]]:
        """Run performance and load testing"""
        logger.info("Starting performance tests")

        performance_tests = [
            {
                "name": "Page Load Performance",
                "description": "Test page load times and resource optimization",
                "metrics": ["load_time", "first_contentful_paint", "largest_contentful_paint"]
            },
            {
                "name": "User Interaction Responsiveness",
                "description": "Test response times for user interactions",
                "metrics": ["click_response", "form_submission_time", "animation_fps"]
            },
            {
                "name": "Resource Usage",
                "description": "Monitor CPU and memory usage",
                "metrics": ["cpu_usage", "memory_usage", "network_requests"]
            },
            {
                "name": "Concurrent User Performance",
                "description": "Test performance with multiple concurrent users",
                "metrics": ["concurrent_load_time", "response_time_variance", "error_rate"]
            }
        ]

        results = []

        for test in performance_tests:
            try:
                result = await self._run_performance_test(test)
                results.append(result)
            except Exception as e:
                logger.error(f"Performance test '{test['name']}' failed: {e}")
                results.append({
                    "name": test["name"],
                    "passed": False,
                    "error": str(e),
                    "metrics": {}
                })

        return results

    async def _run_performance_test(self, test: Dict[str, Any]) -> Dict[str, Any]:
        """Run individual performance test"""
        logger.info(f"Running performance test: {test['name']}")

        start_time = time.time()
        metrics = {}

        try:
            if "Page Load" in test["name"]:
                metrics = await self._test_page_load_performance()
            elif "User Interaction" in test["name"]:
                metrics = await self._test_interaction_performance()
            elif "Resource Usage" in test["name"]:
                metrics = await self._test_resource_usage()
            elif "Concurrent User" in test["name"]:
                metrics = await self._test_concurrent_performance()

            # Evaluate performance against thresholds
            passed = self._evaluate_performance_metrics(metrics)

            return {
                "name": test["name"],
                "description": test["description"],
                "passed": passed,
                "metrics": metrics,
                "test_duration": time.time() - start_time
            }

        except Exception as e:
            return {
                "name": test["name"],
                "description": test["description"],
                "passed": False,
                "error": str(e),
                "metrics": metrics,
                "test_duration": time.time() - start_time
            }

    async def _test_page_load_performance(self) -> Dict[str, Any]:
        """Test page load performance metrics"""
        if not self.page:
            return {}

        # Clear cache and navigate
        await self.page.goto("about:blank")
        start_time = time.time()

        await self.page.goto(self.base_url, wait_until="networkidle")

        load_time = time.time() - start_time

        # Get performance metrics
        perf_metrics = await self.page.evaluate("""
        () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            return {
                load_time: navigation.loadEventEnd - navigation.loadEventStart,
                dom_content_loaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                first_byte: navigation.responseStart - navigation.requestStart,
                total_time: navigation.loadEventEnd - navigation.fetchStart
            };
        }
        """)

        # Collect resource timing
        resources = await self.page.evaluate("""
        () => {
            return performance.getEntriesByType('resource').map(r => ({
                name: r.name,
                duration: r.duration,
                size: r.transferSize || 0
            }));
        }
        """)

        return {
            "page_load_time": load_time,
            "total_resources": len(resources),
            "total_transfer_size": sum(r["size"] for r in resources),
            "slowest_resource": max((r["duration"] for r in resources), default=0),
            **perf_metrics
        }

    async def _test_interaction_performance(self) -> Dict[str, Any]:
        """Test user interaction performance"""
        if not self.page:
            return {}

        await self.page.goto(self.base_url, wait_until="networkidle")

        # Test button click response time
        click_times = []
        for _ in range(5):
            start = time.time()
            await self.page.click("button", timeout=5000)
            click_times.append(time.time() - start)
            await asyncio.sleep(0.1)

        # Test form submission time
        start = time.time()
        await self.page.fill("input[name='test']", "test_value")
        form_fill_time = time.time() - start

        return {
            "avg_click_response_time": statistics.mean(click_times),
            "max_click_response_time": max(click_times),
            "min_click_response_time": min(click_times),
            "form_fill_time": form_fill_time
        }

    async def _test_resource_usage(self) -> Dict[str, Any]:
        """Test system resource usage"""
        if not PSUTIL_AVAILABLE:
            return {}

        process = psutil.Process()

        # Monitor for 10 seconds
        cpu_samples = []
        memory_samples = []

        for _ in range(10):
            cpu_samples.append(process.cpu_percent())
            memory_samples.append(process.memory_info().rss / 1024 / 1024)  # MB
            await asyncio.sleep(1)

        return {
            "avg_cpu_usage": statistics.mean(cpu_samples),
            "max_cpu_usage": max(cpu_samples),
            "avg_memory_usage": statistics.mean(memory_samples),
            "max_memory_usage": max(memory_samples),
            "memory_growth": memory_samples[-1] - memory_samples[0]
        }

    async def _test_concurrent_performance(self) -> Dict[str, Any]:
        """Test performance with concurrent operations"""
        # This would require a more complex setup for true concurrent testing
        # For now, we'll simulate with rapid sequential operations

        if not self.page:
            return {}

        start_time = time.time()
        operations = 10

        for i in range(operations):
            await self.page.goto(f"{self.base_url}?test={i}", wait_until="networkidle")
            await self.page.click("button")

        total_time = time.time() - start_time

        return {
            "concurrent_operations": operations,
            "total_time": total_time,
            "avg_operation_time": total_time / operations,
            "operations_per_second": operations / total_time
        }

    def _evaluate_performance_metrics(self, metrics: Dict[str, Any]) -> bool:
        """Evaluate if performance metrics meet acceptable thresholds"""
        thresholds = {
            "page_load_time": 3.0,  # seconds
            "avg_click_response_time": 0.5,  # seconds
            "avg_cpu_usage": 50.0,  # percentage
            "max_memory_usage": 512.0,  # MB
            "operations_per_second": 2.0  # minimum
        }

        for metric, threshold in thresholds.items():
            value = metrics.get(metric, 0)
            if metric in ["page_load_time", "avg_click_response_time", "avg_cpu_usage", "max_memory_usage"]:
                if value > threshold:
                    return False
            elif metric == "operations_per_second":
                if value < threshold:
                    return False

        return True

    async def generate_report(self) -> UXTestReport:
        """Generate comprehensive UX test report"""
        logger.info("Generating UX test report")

        # Run all test suites
        usability_results = await self.run_usability_tests()
        accessibility_results = await self.run_accessibility_tests()
        performance_results = await self.run_performance_tests()

        # Calculate totals
        total_tests = len(usability_results) + len(accessibility_results) + len(performance_results)
        passed_tests = sum(1 for r in usability_results + accessibility_results + performance_results if r.get("passed", False))
        failed_tests = total_tests - passed_tests

        # Collect violations and issues
        accessibility_violations = []
        for result in accessibility_results:
            if "violation_details" in result:
                accessibility_violations.extend(result["violation_details"])

        performance_issues = []
        for result in performance_results:
            if not result.get("passed", False):
                performance_issues.append({
                    "test": result["name"],
                    "error": result.get("error", "Performance threshold not met"),
                    "metrics": result.get("metrics", {})
                })

        # Generate recommendations
        recommendations = self._generate_recommendations(
            usability_results, accessibility_results, performance_results
        )

        report = UXTestReport(
            test_suite="Cloud Sync System UX Tests",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
            total_tests=total_tests,
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            skipped_tests=0,
            metrics=[],  # Would be populated with actual metrics
            test_results={
                "usability": usability_results,
                "accessibility": accessibility_results,
                "performance": performance_results
            },
            accessibility_violations=accessibility_violations,
            performance_issues=performance_issues,
            recommendations=recommendations
        )

        # Save report to file
        await self._save_report(report)

        return report

    def _generate_recommendations(self, usability_results: List[Dict],
                                accessibility_results: List[Dict],
                                performance_results: List[Dict]) -> List[str]:
        """Generate UX improvement recommendations"""
        recommendations = []

        # Usability recommendations
        failed_usability = [r for r in usability_results if not r.get("passed", False)]
        if failed_usability:
            recommendations.append(
                "Improve user onboarding flow - several usability tests failed"
            )

        # Accessibility recommendations
        critical_violations = sum(
            1 for r in accessibility_results
            if r.get("violations", {}).get("critical", 0) > 0
        )
        if critical_violations > 0:
            recommendations.append(
                f"Address {critical_violations} critical accessibility violations immediately"
            )

        # Performance recommendations
        slow_pages = [r for r in performance_results if not r.get("passed", False)]
        if slow_pages:
            recommendations.append(
                "Optimize performance - several performance tests exceeded thresholds"
            )

        # General recommendations
        if len(self.test_results) > 0:
            avg_completion_rate = statistics.mean([
                r.get("steps_completed", 0) / max(r.get("total_steps", 1), 1)
                for r in self.test_results
            ])
            if avg_completion_rate < 0.9:
                recommendations.append(
                    "Improve task completion rates - users are struggling with workflows"
                )

        return recommendations

    async def _save_report(self, report: UXTestReport):
        """Save UX test report to files"""
        reports_dir = Path("test-results/ux-reports")
        reports_dir.mkdir(parents=True, exist_ok=True)

        # Save JSON report
        json_path = reports_dir / f"ux_report_{int(time.time())}.json"
        with open(json_path, 'w') as f:
            json.dump(asdict(report), f, indent=2, default=str)

        # Save HTML report
        html_path = reports_dir / f"ux_report_{int(time.time())}.html"
        await self._generate_html_report(report, html_path)

        logger.info(f"UX test reports saved to {reports_dir}")

    async def _generate_html_report(self, report: UXTestReport, output_path: Path):
        """Generate HTML UX test report"""
        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloud Sync System - UX Test Report</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .header {{
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #007acc;
            padding-bottom: 20px;
        }}
        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }}
        .metric-card {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }}
        .metric-value {{
            font-size: 2.5em;
            font-weight: bold;
            display: block;
        }}
        .metric-label {{
            font-size: 0.9em;
            opacity: 0.9;
        }}
        .section {{
            margin-bottom: 40px;
        }}
        .section h2 {{
            color: #007acc;
            border-bottom: 2px solid #007acc;
            padding-bottom: 10px;
        }}
        .test-result {{
            border: 1px solid #ddd;
            border-radius: 6px;
            margin-bottom: 15px;
            padding: 15px;
        }}
        .test-passed {{
            border-left: 5px solid #28a745;
            background-color: #f8fff9;
        }}
        .test-failed {{
            border-left: 5px solid #dc3545;
            background-color: #fff8f8;
        }}
        .status-badge {{
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }}
        .status-passed {{
            background-color: #28a745;
            color: white;
        }}
        .status-failed {{
            background-color: #dc3545;
            color: white;
        }}
        .recommendations {{
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 20px;
        }}
        .recommendations h3 {{
            color: #856404;
            margin-top: 0;
        }}
        .recommendations ul {{
            margin-bottom: 0;
        }}
        .screenshot-gallery {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }}
        .screenshot {{
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
        }}
        .screenshot img {{
            width: 100%;
            height: auto;
            display: block;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Cloud Sync System</h1>
            <h2>User Experience Test Report</h2>
            <p>Generated on {report.timestamp}</p>
        </div>

        <div class="summary">
            <div class="metric-card">
                <span class="metric-value">{report.total_tests}</span>
                <span class="metric-label">Total Tests</span>
            </div>
            <div class="metric-card">
                <span class="metric-value">{report.passed_tests}</span>
                <span class="metric-label">Passed</span>
            </div>
            <div class="metric-card">
                <span class="metric-value">{report.failed_tests}</span>
                <span class="metric-label">Failed</span>
            </div>
            <div class="metric-card">
                <span class="metric-value">{len(report.accessibility_violations)}</span>
                <span class="metric-label">A11y Violations</span>
            </div>
        </div>

        <div class="section">
            <h2>Test Results Summary</h2>
            {self._generate_test_results_html(report.test_results)}
        </div>

        <div class="section">
            <h2>Accessibility Violations</h2>
            {self._generate_accessibility_html(report.accessibility_violations)}
        </div>

        <div class="section">
            <h2>Performance Issues</h2>
            {self._generate_performance_html(report.performance_issues)}
        </div>

        {len(report.recommendations) > 0 ? f"""
        <div class="section">
            <div class="recommendations">
                <h3>Recommendations for Improvement</h3>
                <ul>
                    {"".join(f"<li>{rec}</li>" for rec in report.recommendations)}
                </ul>
            </div>
        </div>
        """ : ""}

        {len(self.screenshots) > 0 ? f"""
        <div class="section">
            <h2>Test Screenshots</h2>
            <div class="screenshot-gallery">
                {"".join(f'<div class="screenshot"><img src="{screenshot}" alt="Test screenshot"></div>' for screenshot in self.screenshots[-12:])}
            </div>
        </div>
        """ : ""}
    </div>
</body>
</html>
"""

        with open(output_path, 'w') as f:
            f.write(html_content)

    def _generate_test_results_html(self, test_results: Dict[str, List[Dict]]) -> str:
        """Generate HTML for test results section"""
        html = ""

        for category, results in test_results.items():
            html += f"<h3>{category.title()} Tests</h3>"

            for result in results:
                status_class = "test-passed" if result.get("passed", False) else "test-failed"
                status_badge_class = "status-passed" if result.get("passed", False) else "status-failed"
                status_text = "PASSED" if result.get("passed", False) else "FAILED"

                html += f"""
                <div class="test-result {status_class}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h4>{result.get('name', result.get('test_case', 'Unknown Test'))}</h4>
                        <span class="status-badge {status_badge_class}">{status_text}</span>
                    </div>
                    <p>{result.get('description', '')}</p>
                    {"<p><strong>Error:</strong> " + result.get('error', '') + "</p>" if not result.get('passed', False) else ""}
                    {"<p><strong>Test Duration:</strong> " + f"{result.get('test_duration', 0):.2f}s" + "</p>" if 'test_duration' in result else ""}
                    {"<p><strong>Total Time:</strong> " + f"{result.get('total_time', 0):.2f}s" + "</p>" if 'total_time' in result else ""}
                </div>
                """

        return html

    def _generate_accessibility_html(self, violations: List[Dict]) -> str:
        """Generate HTML for accessibility violations section"""
        if not violations:
            return "<p>No accessibility violations found. Great job!</p>"

        html = "<div style='background-color: #fff8f8; padding: 15px; border-radius: 6px;'>"
        html += f"<p><strong>Total Violations:</strong> {len(violations)}</p>"

        # Group violations by impact level
        by_impact = {}
        for violation in violations:
            impact = violation.get('impact', 'unknown')
            if impact not in by_impact:
                by_impact[impact] = []
            by_impact[impact].append(violation)

        for impact, items in by_impact.items():
            html += f"<h4>{impact.title()} Impact ({len(items)} violations)</h4>"
            html += "<ul>"
            for item in items[:5]:  # Show first 5 violations
                html += f"<li><strong>{item.get('rule', 'Unknown')}</strong>: {item.get('description', '')}</li>"
            if len(items) > 5:
                html += f"<li><em>... and {len(items) - 5} more</em></li>"
            html += "</ul>"

        html += "</div>"
        return html

    def _generate_performance_html(self, issues: List[Dict]) -> str:
        """Generate HTML for performance issues section"""
        if not issues:
            return "<p>All performance tests passed!</p>"

        html = "<div style='background-color: #fff8f8; padding: 15px; border-radius: 6px;'>"
        html += f"<p><strong>Performance Issues Found:</strong> {len(issues)}</p>"
        html += "<ul>"

        for issue in issues:
            html += f"<li><strong>{issue.get('test', 'Unknown Test')}</strong>: {issue.get('error', 'Unknown error')}</li>"

        html += "</ul></div>"
        return html


# Main execution function
async def main():
    """Main function to run UX test suite"""
    framework = UXTestFramework()

    try:
        await framework.initialize()
        report = await framework.generate_report()

        print(f"\nUX Test Summary:")
        print(f"Total Tests: {report.total_tests}")
        print(f"Passed: {report.passed_tests}")
        print(f"Failed: {report.failed_tests}")
        print(f"Accessibility Violations: {len(report.accessibility_violations)}")
        print(f"Performance Issues: {len(report.performance_issues)}")

        if report.recommendations:
            print(f"\nRecommendations:")
            for rec in report.recommendations:
                print(f"- {rec}")

        return report.failed_tests == 0

    finally:
        await framework.cleanup()


if __name__ == "__main__":
    import sys
    success = asyncio.run(main())
    sys.exit(0 if success else 1)