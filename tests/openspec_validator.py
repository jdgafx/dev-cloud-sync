#!/usr/bin/env python3
"""
OpenSpec Validation Testing System
Validates generated specifications against implementation and requirements
"""

import asyncio
import json
import yaml
import ast
import re
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ValidationLevel(Enum):
    """Validation severity levels"""
    CRITICAL = "CRITICAL"
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


@dataclass
class ValidationIssue:
    """Individual validation issue"""
    level: ValidationLevel
    component: str
    description: str
    suggestion: str = ""
    line_number: Optional[int] = None
    file_path: Optional[str] = None


@dataclass
class ValidationResult:
    """Complete validation result"""
    component: str
    status: str  # PASSED, FAILED, PARTIAL
    issues: List[ValidationIssue]
    score: float  # 0.0 to 1.0
    metrics: Dict[str, Any]


@dataclass
class OpenSpecReport:
    """Complete OpenSpec validation report"""
    timestamp: str
    project_name: str
    total_components: int
    validation_results: List[ValidationResult]
    overall_score: float
    critical_issues: int
    recommendations: List[str]
    spec_coverage: Dict[str, float]


class OpenSpecValidator:
    """Main OpenSpec validation system"""

    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.openspec_path = self.project_path / "openspec"
        self.validation_results: List[ValidationResult] = []
        self.critical_issues: List[ValidationIssue] = []

    async def validate_all(self) -> OpenSpecReport:
        """Run complete OpenSpec validation"""
        logger.info("Starting comprehensive OpenSpec validation")

        # Check if OpenSpec exists
        if not self.openspec_path.exists():
            logger.warning(f"OpenSpec directory not found at {self.openspec_path}")
            return await self._generate_empty_report()

        # Validate core components
        validations = [
            self._validate_project_specification(),
            self._validate_system_architecture(),
            self._validate_api_specifications(),
            self._validate_database_schema(),
            self._validate_security_considerations(),
            self._validate_deployment_configuration(),
            self._validate_change_proposals(),
            self._validate_spec_completeness(),
            self._validate_spec_consistency()
        ]

        # Run all validations concurrently
        validation_tasks = [val() for val in validations]
        validation_results = await asyncio.gather(*validation_tasks)

        # Filter out None results
        self.validation_results = [r for r in validation_results if r is not None]

        # Generate report
        return await self._generate_report()

    async def _generate_empty_report(self) -> OpenSpecReport:
        """Generate report for projects without OpenSpec"""
        return OpenSpecReport(
            timestamp=self._get_timestamp(),
            project_name=self.project_path.name,
            total_components=0,
            validation_results=[],
            overall_score=0.0,
            critical_issues=0,
            recommendations=["Initialize OpenSpec for this project using 'openspec create'"],
            spec_coverage={}
        )

    async def _validate_project_specification(self) -> Optional[ValidationResult]:
        """Validate project specification"""
        logger.info("Validating project specification")

        project_spec_path = self.openspec_path / "project.md"
        if not project_spec_path.exists():
            return ValidationResult(
                component="project_specification",
                status="FAILED",
                issues=[ValidationIssue(
                    level=ValidationLevel.CRITICAL,
                    component="project_specification",
                    description="Project specification file not found"
                )],
                score=0.0,
                metrics={"file_exists": False}
            )

        try:
            content = project_spec_path.read_text()
            issues = []

            # Check required sections
            required_sections = [
                "# Project Overview",
                "## Context",
                "## Domain",
                "## Goals",
                "## Scope",
                "## Constraints",
                "## Conventions"
            ]

            for section in required_sections:
                if section not in content:
                    issues.append(ValidationIssue(
                        level=ValidationLevel.ERROR,
                        component="project_specification",
                        description=f"Missing required section: {section}",
                        suggestion=f"Add '{section}' section to project.md"
                    ))

            # Validate project metadata
            metadata_score = self._validate_project_metadata(content, issues)

            # Calculate score
            score = max(0.0, 1.0 - (len([i for i in issues if i.level == ValidationLevel.ERROR]) / len(required_sections)))

            return ValidationResult(
                component="project_specification",
                status="PASSED" if score >= 0.8 else "FAILED",
                issues=issues,
                score=score,
                metrics={
                    "file_exists": True,
                    "sections_found": len(required_sections) - len([i for i in issues if "Missing required section" in i.description]),
                    "total_sections": len(required_sections),
                    "metadata_score": metadata_score
                }
            )

        except Exception as e:
            logger.error(f"Error validating project specification: {e}")
            return ValidationResult(
                component="project_specification",
                status="FAILED",
                issues=[ValidationIssue(
                    level=ValidationLevel.CRITICAL,
                    component="project_specification",
                    description=f"Failed to read project specification: {str(e)}"
                )],
                score=0.0,
                metrics={"error": str(e)}
            )

    def _validate_project_metadata(self, content: str, issues: List[ValidationIssue]) -> float:
        """Validate project metadata completeness"""
        metadata_checks = [
            ("Project name", r"(?i)project\s*name\s*[:#]"),
            ("Description", r"(?i)description\s*[:#]"),
            ("Version", r"(?i)version\s*[:#]"),
            ("Author", r"(?i)author\s*[:#]"),
            ("Created date", r"(?i)created\s*[:#]"),
            ("Last updated", r"(?i)last\s*updated\s*[:#]")
        ]

        found_count = 0
        for name, pattern in metadata_checks:
            if re.search(pattern, content):
                found_count += 1
            else:
                issues.append(ValidationIssue(
                    level=ValidationLevel.WARNING,
                    component="project_specification",
                    description=f"Missing project metadata: {name}",
                    suggestion=f"Add {name.lower()} to the project specification"
                ))

        return found_count / len(metadata_checks)

    async def _validate_system_architecture(self) -> Optional[ValidationResult]:
        """Validate system architecture specifications"""
        logger.info("Validating system architecture")

        specs_dir = self.openspec_path / "specs"
        if not specs_dir.exists():
            return None  # Architecture specs are optional

        architecture_specs = list(specs_dir.glob("**/*architecture*.md"))
        if not architecture_specs:
            return ValidationResult(
                component="system_architecture",
                status="PARTIAL",
                issues=[ValidationIssue(
                    level=ValidationLevel.WARNING,
                    component="system_architecture",
                    description="No architecture specifications found",
                    suggestion="Create architecture specifications for major system components"
                )],
                score=0.5,
                metrics={"specs_found": 0}
            )

        issues = []
        total_score = 0.0
        validated_specs = 0

        for spec_path in architecture_specs:
            try:
                content = spec_path.read_text()
                spec_score, spec_issues = self._validate_architecture_spec(content, str(spec_path))
                total_score += spec_score
                validated_specs += 1
                issues.extend(spec_issues)
            except Exception as e:
                issues.append(ValidationIssue(
                    level=ValidationLevel.ERROR,
                    component="system_architecture",
                    description=f"Failed to validate {spec_path}: {str(e)}",
                    file_path=str(spec_path)
                ))

        overall_score = total_score / validated_specs if validated_specs > 0 else 0.0

        return ValidationResult(
            component="system_architecture",
            status="PASSED" if overall_score >= 0.8 else "FAILED" if overall_score >= 0.5 else "PARTIAL",
            issues=issues,
            score=overall_score,
            metrics={
                "specs_found": len(architecture_specs),
                "specs_validated": validated_specs,
                "average_score": overall_score
            }
        )

    def _validate_architecture_spec(self, content: str, spec_path: str) -> Tuple[float, List[ValidationIssue]]:
        """Validate individual architecture specification"""
        issues = []

        # Check for required architecture components
        required_components = [
            "## Components",
            "## Dependencies",
            "## Data Flow",
            "## Interfaces"
        ]

        score = 1.0
        for component in required_components:
            if component not in content:
                score -= 0.2
                issues.append(ValidationIssue(
                    level=ValidationLevel.ERROR,
                    component="system_architecture",
                    description=f"Missing architecture component: {component}",
                    suggestion=f"Add {component.lower()} section to architecture specification",
                    file_path=spec_path
                ))

        # Check for diagrams and visualizations
        if "![" not in content and "```mermaid" not in content:
            score -= 0.1
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                component="system_architecture",
                description="No diagrams or visualizations found",
                suggestion="Add architecture diagrams using Mermaid or images",
                file_path=spec_path
            ))

        return max(0.0, score), issues

    async def _validate_api_specifications(self) -> Optional[ValidationResult]:
        """Validate API specifications"""
        logger.info("Validating API specifications")

        api_specs = list(self.project_path.rglob("*api*.md"))
        api_specs.extend(list(self.project_path.rglob("*endpoint*.md")))

        if not api_specs:
            return ValidationResult(
                component="api_specifications",
                status="PARTIAL",
                issues=[ValidationIssue(
                    level=ValidationLevel.WARNING,
                    component="api_specifications",
                    description="No API specifications found",
                    suggestion="Document all API endpoints and interfaces"
                )],
                score=0.5,
                metrics={"api_specs_found": 0}
            )

        issues = []
        total_score = 0.0
        validated_specs = 0

        for spec_path in api_specs:
            try:
                content = spec_path.read_text()
                spec_score, spec_issues = self._validate_api_spec(content, str(spec_path))
                total_score += spec_score
                validated_specs += 1
                issues.extend(spec_issues)
            except Exception as e:
                issues.append(ValidationIssue(
                    level=ValidationLevel.ERROR,
                    component="api_specifications",
                    description=f"Failed to validate {spec_path}: {str(e)}",
                    file_path=str(spec_path)
                ))

        overall_score = total_score / validated_specs if validated_specs > 0 else 0.0

        # Cross-validate with actual implementation
        implementation_validation = await self._validate_api_implementation()
        issues.extend(implementation_validation["issues"])
        overall_score = min(overall_score, implementation_validation["score"])

        return ValidationResult(
            component="api_specifications",
            status="PASSED" if overall_score >= 0.8 else "FAILED" if overall_score >= 0.5 else "PARTIAL",
            issues=issues,
            score=overall_score,
            metrics={
                "api_specs_found": len(api_specs),
                "specs_validated": validated_specs,
                "average_score": total_score / validated_specs if validated_specs > 0 else 0.0,
                "implementation_match": implementation_validation["score"]
            }
        )

    async def _validate_api_implementation(self) -> Dict[str, Any]:
        """Validate API specifications against actual implementation"""
        issues = []
        score = 1.0

        # Find Python API implementations
        api_files = list(self.project_path.rglob("*.py"))
        implemented_endpoints = set()

        for file_path in api_files:
            try:
                content = file_path.read_text()
                # Extract route definitions (Flask, FastAPI, etc.)
                routes = re.findall(r'@[^)]*route\([\'"]([^\'"]+)[\'"]', content)
                implemented_endpoints.update(routes)

                # Extract FastAPI endpoints
                fastapi_routes = re.findall(r'@(app|router)\.(get|post|put|delete|patch)\([\'"]([^\'"]+)[\'"]', content)
                for _, method, path in fastapi_routes:
                    implemented_endpoints.add(f"{method.upper()} {path}")

            except Exception:
                continue

        # Find OpenAPI/Swagger specifications
        openapi_files = list(self.project_path.rglob("openapi*.json")) + list(self.project_path.rglob("swagger*.json"))
        spec_endpoints = set()

        for spec_file in openapi_files:
            try:
                with open(spec_file) as f:
                    spec = json.load(f)
                    paths = spec.get("paths", {})
                    for path, methods in paths.items():
                        for method in methods:
                            if method.upper() in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
                                spec_endpoints.add(f"{method.upper()} {path}")
            except Exception:
                continue

        # Compare implementation and specification
        missing_in_spec = implemented_endpoints - spec_endpoints
        missing_in_impl = spec_endpoints - implemented_endpoints

        if missing_in_spec:
            score -= len(missing_in_spec) * 0.05
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                component="api_specifications",
                description=f"{len(missing_in_spec)} endpoints implemented but not specified",
                suggestion="Add missing endpoints to API specification",
                file_path="implementation_analysis"
            ))

        if missing_in_impl:
            score -= len(missing_in_impl) * 0.1
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                component="api_specifications",
                description=f"{len(missing_in_impl)} endpoints specified but not implemented",
                suggestion="Implement missing endpoints or update specification",
                file_path="implementation_analysis"
            ))

        return {
            "score": max(0.0, score),
            "issues": issues,
            "implemented_endpoints": len(implemented_endpoints),
            "specified_endpoints": len(spec_endpoints)
        }

    def _validate_api_spec(self, content: str, spec_path: str) -> Tuple[float, List[ValidationIssue]]:
        """Validate individual API specification"""
        issues = []

        # Check for required API components
        required_components = [
            "## Overview",
            "## Authentication",
            "## Endpoints",
            "## Data Models"
        ]

        score = 1.0
        for component in required_components:
            if component not in content:
                score -= 0.2
                issues.append(ValidationIssue(
                    level=ValidationLevel.ERROR,
                    component="api_specifications",
                    description=f"Missing API component: {component}",
                    suggestion=f"Add {component.lower()} section to API specification",
                    file_path=spec_path
                ))

        # Check for example requests/responses
        if "```json" not in content and "```yaml" not in content:
            score -= 0.1
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                component="api_specifications",
                description="No example requests/responses found",
                suggestion="Add example JSON/YAML for API requests and responses",
                file_path=spec_path
            ))

        # Check for status codes documentation
        if not re.search(r'(status|code)\s*[:=]\s*\d{3}', content, re.IGNORECASE):
            score -= 0.1
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                component="api_specifications",
                description="HTTP status codes not documented",
                suggestion="Document expected HTTP status codes for each endpoint",
                file_path=spec_path
            ))

        return max(0.0, score), issues

    async def _validate_database_schema(self) -> Optional[ValidationResult]:
        """Validate database schema specifications"""
        logger.info("Validating database schema")

        schema_files = (
            list(self.project_path.rglob("*schema*.sql")) +
            list(self.project_path.rglob("*database*.md")) +
            list(self.project_path.rglob("*migration*.py"))
        )

        if not schema_files:
            return ValidationResult(
                component="database_schema",
                status="PARTIAL",
                issues=[ValidationIssue(
                    level=ValidationLevel.INFO,
                    component="database_schema",
                    description="No database schema files found",
                    suggestion="Document database schema if the project uses databases"
                )],
                score=0.8,  # Not all projects use databases
                metrics={"schema_files_found": 0}
            )

        issues = []
        total_score = 0.0
        validated_schemas = 0

        for schema_file in schema_files:
            try:
                if schema_file.suffix == '.sql':
                    score, schema_issues = self._validate_sql_schema(schema_file)
                elif schema_file.suffix == '.md':
                    content = schema_file.read_text()
                    score, schema_issues = self._validate_database_doc(content, str(schema_file))
                elif schema_file.suffix == '.py':
                    content = schema_file.read_text()
                    score, schema_issues = self._validate_migration_schema(content, str(schema_file))
                else:
                    continue

                total_score += score
                validated_schemas += 1
                issues.extend(schema_issues)

            except Exception as e:
                issues.append(ValidationIssue(
                    level=ValidationLevel.ERROR,
                    component="database_schema",
                    description=f"Failed to validate {schema_file}: {str(e)}",
                    file_path=str(schema_file)
                ))

        overall_score = total_score / validated_schemas if validated_schemas > 0 else 0.0

        return ValidationResult(
            component="database_schema",
            status="PASSED" if overall_score >= 0.8 else "FAILED" if overall_score >= 0.5 else "PARTIAL",
            issues=issues,
            score=overall_score,
            metrics={
                "schema_files_found": len(schema_files),
                "schemas_validated": validated_schemas,
                "average_score": overall_score
            }
        )

    def _validate_sql_schema(self, schema_file: Path) -> Tuple[float, List[ValidationIssue]]:
        """Validate SQL schema file"""
        issues = []
        content = schema_file.read_text()

        score = 1.0

        # Check for primary keys
        if "PRIMARY KEY" not in content.upper():
            score -= 0.2
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                component="database_schema",
                description="No PRIMARY KEY constraints found",
                suggestion="Add PRIMARY KEY constraints to all tables",
                file_path=str(schema_file)
            ))

        # Check for foreign key relationships
        table_count = len(re.findall(r'CREATE TABLE', content, re.IGNORECASE))
        fk_count = len(re.findall(r'FOREIGN KEY', content, re.IGNORECASE))

        if table_count > 1 and fk_count == 0:
            score -= 0.1
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                component="database_schema",
                description="Multiple tables but no FOREIGN KEY relationships",
                suggestion="Consider adding foreign key constraints to establish relationships",
                file_path=str(schema_file)
            ))

        # Check for indexes on commonly queried columns
        if "INDEX" not in content.upper() and table_count > 2:
            score -= 0.1
            issues.append(ValidationIssue(
                level=ValidationLevel.INFO,
                component="database_schema",
                description="No INDEX definitions found",
                suggestion="Consider adding indexes for frequently queried columns",
                file_path=str(schema_file)
            ))

        return max(0.0, score), issues

    def _validate_database_doc(self, content: str, file_path: str) -> Tuple[float, List[ValidationIssue]]:
        """Validate database documentation"""
        issues = []

        required_sections = ["## Tables", "## Relationships", "## Data Types"]
        score = 1.0

        for section in required_sections:
            if section not in content:
                score -= 0.2
                issues.append(ValidationIssue(
                    level=ValidationLevel.WARNING,
                    component="database_schema",
                    description=f"Missing database documentation section: {section}",
                    suggestion=f"Add {section.lower()} section to database documentation",
                    file_path=file_path
                ))

        return max(0.0, score), issues

    def _validate_migration_schema(self, content: str, file_path: str) -> Tuple[float, List[ValidationIssue]]:
        """Validate migration schema files"""
        issues = []
        score = 1.0

        # Check for migration versioning
        if not re.search(r'(version|migration_id|upgrade|downgrade)', content, re.IGNORECASE):
            score -= 0.2
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                component="database_schema",
                description="Migration versioning not found",
                suggestion="Add versioning to migration files",
                file_path=file_path
            ))

        # Check for rollback functionality
        if "def downgrade" not in content and "def rollback" not in content:
            score -= 0.1
            issues.append(ValidationIssue(
                level=ValidationLevel.INFO,
                component="database_schema",
                description="No rollback functionality found",
                suggestion="Add rollback capability for database migrations",
                file_path=file_path
            ))

        return max(0.0, score), issues

    async def _validate_security_considerations(self) -> Optional[ValidationResult]:
        """Validate security considerations in specifications"""
        logger.info("Validating security considerations")

        security_files = (
            list(self.project_path.rglob("*security*.md")) +
            list(self.project_path.rglob("*auth*.md"))
        )

        if not security_files:
            # Look for security sections in other files
            all_md_files = list(self.project_path.rglob("*.md"))
            security_content = []
            for md_file in all_md_files:
                try:
                    content = md_file.read_text()
                    if "security" in content.lower() or "authentication" in content.lower():
                        security_content.append((str(md_file), content))
                except Exception:
                    continue

            if not security_content:
                return ValidationResult(
                    component="security_considerations",
                    status="FAILED",
                    issues=[ValidationIssue(
                        level=ValidationLevel.CRITICAL,
                        component="security_considerations",
                        description="No security considerations found",
                        suggestion="Document security measures, authentication, and authorization"
                    )],
                    score=0.0,
                    metrics={"security_files_found": 0}
                )

        issues = []
        total_score = 0.0
        validated_files = 0

        # Check for required security topics
        required_security_topics = [
            "Authentication",
            "Authorization",
            "Data Encryption",
            "Input Validation",
            "Error Handling",
            "Logging and Auditing"
        ]

        security_topics_found = set()

        for file_path, content in security_content if security_files else [(None, "\n".join(c for _, c in security_content))]:
            topics_in_file = []
            for topic in required_security_topics:
                if topic.lower() in content.lower():
                    topics_in_file.append(topic)
                    security_topics_found.add(topic)

            score = len(topics_in_file) / len(required_security_topics)
            total_score += score
            validated_files += 1

            missing_topics = set(required_security_topics) - set(topics_in_file)
            for topic in missing_topics:
                issues.append(ValidationIssue(
                    level=ValidationLevel.WARNING if topic in ["Logging and Auditing"] else ValidationLevel.ERROR,
                    component="security_considerations",
                    description=f"Security topic not documented: {topic}",
                    suggestion=f"Add documentation for {topic.lower()}",
                    file_path=file_path
                ))

        overall_score = total_score / validated_files if validated_files > 0 else 0.0

        return ValidationResult(
            component="security_considerations",
            status="PASSED" if overall_score >= 0.8 else "FAILED" if overall_score >= 0.6 else "PARTIAL",
            issues=issues,
            score=overall_score,
            metrics={
                "security_files_found": len(security_files) + (1 if security_files else 0),
                "security_topics_found": len(security_topics_found),
                "total_security_topics": len(required_security_topics)
            }
        )

    async def _validate_deployment_configuration(self) -> Optional[ValidationResult]:
        """Validate deployment configuration specifications"""
        logger.info("Validating deployment configuration")

        deployment_files = (
            list(self.project_path.rglob("docker-compose*.yml")) +
            list(self.project_path.rglob("Dockerfile*")) +
            list(self.project_path.rglob("*deploy*.md")) +
            list(self.project_path.rglob("*install*.sh")) +
            list(self.project_path.rglob("k8s/**/*.yaml"))
        )

        if not deployment_files:
            return ValidationResult(
                component="deployment_configuration",
                status="PARTIAL",
                issues=[ValidationIssue(
                    level=ValidationLevel.WARNING,
                    component="deployment_configuration",
                    description="No deployment configuration found",
                    suggestion="Add deployment documentation and configuration files"
                )],
                score=0.6,
                metrics={"deployment_files_found": 0}
            )

        issues = []
        total_score = 0.0
        validated_files = 0

        for deploy_file in deployment_files:
            try:
                if deploy_file.suffix in ['.yml', '.yaml']:
                    score, file_issues = self._validate_yaml_config(deploy_file)
                elif deploy_file.suffix == '.sh':
                    score, file_issues = self._validate_install_script(deploy_file)
                else:
                    continue

                total_score += score
                validated_files += 1
                issues.extend(file_issues)

            except Exception as e:
                issues.append(ValidationIssue(
                    level=ValidationLevel.ERROR,
                    component="deployment_configuration",
                    description=f"Failed to validate {deploy_file}: {str(e)}",
                    file_path=str(deploy_file)
                ))

        overall_score = total_score / validated_files if validated_files > 0 else 0.0

        return ValidationResult(
            component="deployment_configuration",
            status="PASSED" if overall_score >= 0.8 else "FAILED" if overall_score >= 0.6 else "PARTIAL",
            issues=issues,
            score=overall_score,
            metrics={
                "deployment_files_found": len(deployment_files),
                "files_validated": validated_files,
                "average_score": overall_score
            }
        )

    def _validate_yaml_config(self, yaml_file: Path) -> Tuple[float, List[ValidationIssue]]:
        """Validate YAML configuration files"""
        issues = []
        score = 1.0

        try:
            with open(yaml_file) as f:
                config = yaml.safe_load(f)

            # Check for common configuration issues
            if isinstance(config, dict):
                # Check for hardcoded secrets
                config_str = str(config)
                if any(secret in config_str.lower() for secret in ['password', 'secret', 'key', 'token']):
                    if re.search(r'(password|secret|key|token):\s*[\'"][^\'\"]*[\'"]', config_str):
                        score -= 0.3
                        issues.append(ValidationIssue(
                            level=ValidationLevel.ERROR,
                            component="deployment_configuration",
                            description="Potential hardcoded secrets found in configuration",
                            suggestion="Use environment variables or secret management",
                            file_path=str(yaml_file)
                        ))

                # Check for resource limits
                if 'services' in config:
                    for service_name, service_config in config['services'].items():
                        if isinstance(service_config, dict):
                            if 'deploy' not in service_config and 'limits' not in service_config:
                                score -= 0.1
                                issues.append(ValidationIssue(
                                    level=ValidationLevel.INFO,
                                    component="deployment_configuration",
                                    description=f"No resource limits defined for service: {service_name}",
                                    suggestion="Add resource limits for production deployments",
                                    file_path=str(yaml_file)
                                ))

        except yaml.YAMLError as e:
            score = 0.0
            issues.append(ValidationIssue(
                level=ValidationLevel.CRITICAL,
                component="deployment_configuration",
                description=f"Invalid YAML syntax: {str(e)}",
                suggestion="Fix YAML syntax errors",
                file_path=str(yaml_file)
            ))

        return max(0.0, score), issues

    def _validate_install_script(self, script_file: Path) -> Tuple[float, List[ValidationIssue]]:
        """Validate installation scripts"""
        issues = []
        content = script_file.read_text()
        score = 1.0

        # Check for error handling
        if "set -e" not in content and "set -euo pipefail" not in content:
            score -= 0.2
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                component="deployment_configuration",
                description="Script does not exit on errors",
                suggestion="Add 'set -e' or 'set -euo pipefail' at the beginning of the script",
                file_path=str(script_file)
            ))

        # Check for input validation
        if "$1" in content and not re.search(r'\[.*\$\{.*\}.*\]', content):
            score -= 0.1
            issues.append(ValidationIssue(
                level=ValidationLevel.INFO,
                component="deployment_configuration",
                description="Script parameters not validated",
                suggestion="Add input validation for script parameters",
                file_path=str(script_file)
            ))

        # Check for help documentation
        if "--help" not in content and "-h" not in content:
            score -= 0.1
            issues.append(ValidationIssue(
                level=ValidationLevel.INFO,
                component="deployment_configuration",
                description="No help option available",
                suggestion="Add --help or -h option to show usage information",
                file_path=str(script_file)
            ))

        return max(0.0, score), issues

    async def _validate_change_proposals(self) -> Optional[ValidationResult]:
        """Validate change proposals in OpenSpec"""
        logger.info("Validating change proposals")

        changes_dir = self.openspec_path / "changes"
        if not changes_dir.exists():
            return ValidationResult(
                component="change_proposals",
                status="PASSED",  # No changes is OK
                issues=[],
                score=1.0,
                metrics={"changes_found": 0}
            )

        change_dirs = [d for d in changes_dir.iterdir() if d.is_dir()]
        issues = []
        total_score = 0.0
        validated_changes = 0

        for change_dir in change_dirs:
            proposal_file = change_dir / "proposal.md"
            tasks_file = change_dir / "tasks.md"

            if not proposal_file.exists():
                issues.append(ValidationIssue(
                    level=ValidationLevel.ERROR,
                    component="change_proposals",
                    description=f"Missing proposal.md in {change_dir.name}",
                    suggestion="Create proposal.md file for the change",
                    file_path=str(change_dir)
                ))
                continue

            try:
                # Validate proposal
                proposal_content = proposal_file.read_text()
                proposal_score, proposal_issues = self._validate_change_proposal(proposal_content, str(proposal_file))
                total_score += proposal_score
                validated_changes += 1
                issues.extend(proposal_issues)

                # Validate tasks if present
                if tasks_file.exists():
                    tasks_content = tasks_file.read_text()
                    tasks_score, tasks_issues = self._validate_change_tasks(tasks_content, str(tasks_file))
                    total_score = (total_score + tasks_score) / 2
                    issues.extend(tasks_issues)

            except Exception as e:
                issues.append(ValidationIssue(
                    level=ValidationLevel.ERROR,
                    component="change_proposals",
                    description=f"Failed to validate {change_dir}: {str(e)}",
                    file_path=str(change_dir)
                ))

        overall_score = total_score / validated_changes if validated_changes > 0 else 0.0

        return ValidationResult(
            component="change_proposals",
            status="PASSED" if overall_score >= 0.8 else "FAILED" if overall_score >= 0.6 else "PARTIAL",
            issues=issues,
            score=overall_score,
            metrics={
                "changes_found": len(change_dirs),
                "changes_validated": validated_changes,
                "average_score": overall_score
            }
        )

    def _validate_change_proposal(self, content: str, file_path: str) -> Tuple[float, List[ValidationIssue]]:
        """Validate individual change proposal"""
        issues = []

        required_sections = [
            "## Summary",
            "## Motivation",
            "## Changes",
            "## Impact"
        ]

        score = 1.0
        for section in required_sections:
            if section not in content:
                score -= 0.2
                issues.append(ValidationIssue(
                    level=ValidationLevel.WARNING,
                    component="change_proposals",
                    description=f"Missing proposal section: {section}",
                    suggestion=f"Add {section.lower()} section to proposal",
                    file_path=file_path
                ))

        return max(0.0, score), issues

    def _validate_change_tasks(self, content: str, file_path: str) -> Tuple[float, List[ValidationIssue]]:
        """Validate change tasks documentation"""
        issues = []

        # Check for task breakdown
        if "- [ ]" not in content and "* [ ]" not in content:
            score = 0.7
            issues.append(ValidationIssue(
                level=ValidationLevel.INFO,
                component="change_proposals",
                description="No task checklist found",
                suggestion="Add checklist of implementation tasks",
                file_path=file_path
            ))
        else:
            score = 1.0

        return score, issues

    async def _validate_spec_completeness(self) -> Optional[ValidationResult]:
        """Validate overall specification completeness"""
        logger.info("Validating specification completeness")

        # Check implementation coverage
        implementation_files = (
            list(self.project_path.rglob("*.py")) +
            list(self.project_path.rglob("*.js")) +
            list(self.project_path.rglob("*.ts")) +
            list(self.project_path.rglob("*.java")) +
            list(self.project_path.rglob("*.cpp")) +
            list(self.project_path.rglob("*.c"))
        )

        spec_files = (
            list(self.openspec_path.rglob("*.md")) +
            list(self.openspec_path.rglob("*.yml")) +
            list(self.openspec_path.rglob("*.yaml"))
        )

        if not implementation_files:
            return ValidationResult(
                component="spec_completeness",
                status="PASSED",
                issues=[],
                score=1.0,
                metrics={"implementation_files": 0, "spec_files": len(spec_files)}
            )

        # Calculate coverage metrics
        issues = []
        total_complexity = 0
        documented_complexity = 0

        for impl_file in implementation_files:
            try:
                content = impl_file.read_text()
                # Simple complexity metric: lines of code
                complexity = len([line for line in content.splitlines() if line.strip() and not line.strip().startswith('#')])
                total_complexity += complexity

                # Check if file has corresponding documentation
                relative_path = impl_file.relative_to(self.project_path)
                doc_candidates = [
                    self.openspec_path / str(relative_path).replace(impl_file.suffix, '.md'),
                    self.openspec_path / f"{relative_path.stem}_spec.md",
                    self.project_path / f"{relative_path}.md"
                ]

                for doc_candidate in doc_candidates:
                    if doc_candidate.exists():
                        documented_complexity += complexity
                        break

            except Exception:
                continue

        coverage_score = documented_complexity / total_complexity if total_complexity > 0 else 1.0

        if coverage_score < 0.7:
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                component="spec_completeness",
                description=f"Low documentation coverage: {coverage_score:.1%}",
                suggestion="Add documentation for undocumented implementation files"
            ))

        return ValidationResult(
            component="spec_completeness",
            status="PASSED" if coverage_score >= 0.7 else "FAILED",
            issues=issues,
            score=coverage_score,
            metrics={
                "implementation_files": len(implementation_files),
                "spec_files": len(spec_files),
                "total_complexity": total_complexity,
                "documented_complexity": documented_complexity,
                "coverage_percentage": coverage_score
            }
        )

    async def _validate_spec_consistency(self) -> Optional[ValidationResult]:
        """Validate consistency across specifications"""
        logger.info("Validating specification consistency")

        issues = []
        consistency_score = 1.0

        # Collect all specification content
        spec_content = {}
        for spec_file in self.openspec_path.rglob("*.md"):
            try:
                content = spec_file.read_text()
                spec_content[str(spec_file)] = content
            except Exception:
                continue

        if len(spec_content) < 2:
            return ValidationResult(
                component="spec_consistency",
                status="PASSED",
                issues=[],
                score=1.0,
                metrics={"spec_files_checked": len(spec_content)}
            )

        # Check for naming consistency
        naming_patterns = {}
        for file_path, content in spec_content.items():
            # Extract component names, API endpoints, etc.
            components = re.findall(r'##\s+([A-Z][a-zA-Z0-9\s]+)', content)
            naming_patterns[file_path] = [comp.strip() for comp in components]

        # Look for inconsistent naming
        all_names = []
        for names in naming_patterns.values():
            all_names.extend(names)

        # Check for similar components with different names
        similar_names = {}
        for name in all_names:
            normalized = re.sub(r'[^a-zA-Z0-9]', '', name.lower())
            if normalized not in similar_names:
                similar_names[normalized] = []
            similar_names[normalized].append(name)

        for normalized, names in similar_names.items():
            if len(set(names)) > 1:
                consistency_score -= 0.1
                issues.append(ValidationIssue(
                    level=ValidationLevel.WARNING,
                    component="spec_consistency",
                    description=f"Inconsistent naming: {', '.join(set(names))}",
                    suggestion="Use consistent naming across all specifications"
                ))

        return ValidationResult(
            component="spec_consistency",
            status="PASSED" if consistency_score >= 0.8 else "FAILED",
            issues=issues,
            score=consistency_score,
            metrics={
                "spec_files_checked": len(spec_content),
                "components_found": len(all_names),
                "naming_inconsistencies": len([n for n in similar_names.values() if len(set(n)) > 1])
            }
        )

    async def _generate_report(self) -> OpenSpecReport:
        """Generate complete OpenSpec validation report"""
        logger.info("Generating OpenSpec validation report")

        # Calculate overall metrics
        total_components = len(self.validation_results)
        if total_components == 0:
            overall_score = 0.0
        else:
            overall_score = sum(r.score for r in self.validation_results) / total_components

        critical_issues = sum(
            len([i for i in r.issues if i.level == ValidationLevel.CRITICAL])
            for r in self.validation_results
        )

        # Generate recommendations
        recommendations = self._generate_recommendations()

        # Calculate spec coverage
        spec_coverage = {}
        for result in self.validation_results:
            spec_coverage[result.component] = result.score

        report = OpenSpecReport(
            timestamp=self._get_timestamp(),
            project_name=self.project_path.name,
            total_components=total_components,
            validation_results=self.validation_results,
            overall_score=overall_score,
            critical_issues=critical_issues,
            recommendations=recommendations,
            spec_coverage=spec_coverage
        )

        # Save report to file
        await self._save_report(report)

        return report

    def _generate_recommendations(self) -> List[str]:
        """Generate improvement recommendations based on validation results"""
        recommendations = []

        # Analyze common issues
        component_scores = {r.component: r.score for r in self.validation_results}
        low_score_components = [comp for comp, score in component_scores.items() if score < 0.6]

        if low_score_components:
            recommendations.append(
                f"Focus on improving specifications for: {', '.join(low_score_components)}"
            )

        # Check for missing critical components
        validated_components = {r.component for r in self.validation_results}
        critical_components = {
            "project_specification", "system_architecture", "api_specifications"
        }
        missing_critical = critical_components - validated_components

        if missing_critical:
            recommendations.append(
                f"Add missing critical specifications: {', '.join(missing_critical)}"
            )

        # Check for security gaps
        security_result = next((r for r in self.validation_results if r.component == "security_considerations"), None)
        if security_result and security_result.score < 0.7:
            recommendations.append(
                "Improve security documentation - add comprehensive security considerations"
            )

        # Check for deployment gaps
        deployment_result = next((r for r in self.validation_results if r.component == "deployment_configuration"), None)
        if deployment_result and deployment_result.score < 0.6:
            recommendations.append(
                "Add deployment configuration and documentation"
            )

        if not recommendations:
            recommendations.append("Excellent specification coverage! Keep maintaining current quality standards.")

        return recommendations

    async def _save_report(self, report: OpenSpecReport):
        """Save OpenSpec validation report to files"""
        reports_dir = Path("test-results/openspec-reports")
        reports_dir.mkdir(parents=True, exist_ok=True)

        # Save JSON report
        json_path = reports_dir / f"openspec_validation_{int(time.time())}.json"
        with open(json_path, 'w') as f:
            json.dump(asdict(report), f, indent=2, default=str)

        # Save HTML report
        html_path = reports_dir / f"openspec_validation_{int(time.time())}.html"
        await self._generate_html_report(report, html_path)

        logger.info(f"OpenSpec validation report saved to {reports_dir}")

    async def _generate_html_report(self, report: OpenSpecReport, output_path: Path):
        """Generate HTML OpenSpec validation report"""
        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenSpec Validation Report - {report.project_name}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0 0 10px 0;
            font-size: 2.5em;
            font-weight: 700;
        }}
        .header p {{
            margin: 0;
            opacity: 0.9;
            font-size: 1.1em;
        }}
        .metrics {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8fafc;
        }}
        .metric-card {{
            background: white;
            padding: 25px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            border-left: 4px solid #4F46E5;
        }}
        .metric-value {{
            font-size: 2.5em;
            font-weight: bold;
            color: #4F46E5;
            display: block;
            margin-bottom: 5px;
        }}
        .metric-label {{
            color: #64748b;
            font-weight: 500;
        }}
        .content {{
            padding: 30px;
        }}
        .section {{
            margin-bottom: 40px;
        }}
        .section h2 {{
            color: #1e293b;
            border-bottom: 3px solid #4F46E5;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 1.5em;
        }}
        .result-card {{
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 20px;
            overflow: hidden;
            transition: all 0.3s ease;
        }}
        .result-card:hover {{
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }}
        .result-header {{
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e2e8f0;
        }}
        .result-title {{
            font-weight: 600;
            color: #1e293b;
            font-size: 1.1em;
        }}
        .status-badge {{
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
            text-transform: uppercase;
        }}
        .status-passed {{
            background: #dcfce7;
            color: #15803d;
        }}
        .status-failed {{
            background: #fee2e2;
            color: #dc2626;
        }}
        .status-partial {{
            background: #fef3c7;
            color: #d97706;
        }}
        .result-body {{
            padding: 20px;
        }}
        .score-bar {{
            background: #e2e8f0;
            border-radius: 10px;
            height: 8px;
            margin: 15px 0;
            overflow: hidden;
        }}
        .score-fill {{
            height: 100%;
            background: linear-gradient(90deg, #4F46E5 0%, #7C3AED 100%);
            border-radius: 10px;
            transition: width 0.3s ease;
        }}
        .issues {{
            margin-top: 15px;
        }}
        .issue {{
            padding: 12px;
            margin-bottom: 10px;
            border-radius: 6px;
            border-left: 4px solid;
        }}
        .issue-critical {{
            background: #fee2e2;
            border-color: #dc2626;
        }}
        .issue-error {{
            background: #fef3c7;
            border-color: #d97706;
        }}
        .issue-warning {{
            background: #f0f9ff;
            border-color: #0369a1;
        }}
        .issue-info {{
            background: #f8fafc;
            border-color: #64748b;
        }}
        .recommendations {{
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-radius: 10px;
            padding: 25px;
            margin-top: 30px;
        }}
        .recommendations h3 {{
            color: #92400e;
            margin-top: 0;
            font-size: 1.3em;
        }}
        .recommendations ul {{
            margin: 0;
            padding-left: 20px;
        }}
        .recommendations li {{
            margin-bottom: 10px;
            color: #78350f;
        }}
        .coverage-chart {{
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-top: 20px;
        }}
        .coverage-item {{
            flex: 1;
            min-width: 200px;
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }}
        .coverage-bar {{
            background: #e2e8f0;
            border-radius: 10px;
            height: 6px;
            margin: 10px 0;
        }}
        .coverage-fill {{
            height: 100%;
            border-radius: 10px;
        }}
        .coverage-fill.high {{
            background: #22c55e;
            width: {report.overall_score * 100}%;
        }}
        .coverage-fill.medium {{
            background: #f59e0b;
            width: {report.overall_score * 100}%;
        }}
        .coverage-fill.low {{
            background: #ef4444;
            width: {report.overall_score * 100}%;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>OpenSpec Validation Report</h1>
            <p>{report.project_name}</p>
            <p>Generated on {report.timestamp}</p>
        </div>

        <div class="metrics">
            <div class="metric-card">
                <span class="metric-value">{report.overall_score:.1%}</span>
                <span class="metric-label">Overall Score</span>
            </div>
            <div class="metric-card">
                <span class="metric-value">{report.total_components}</span>
                <span class="metric-label">Components Validated</span>
            </div>
            <div class="metric-card">
                <span class="metric-value">{sum(1 for r in report.validation_results if r.status == 'PASSED')}</span>
                <span class="metric-label">Components Passed</span>
            </div>
            <div class="metric-card">
                <span class="metric-value">{report.critical_issues}</span>
                <span class="metric-label">Critical Issues</span>
            </div>
        </div>

        <div class="content">
            <div class="section">
                <h2>Validation Results</h2>
                {self._generate_results_html(report.validation_results)}
            </div>

            <div class="section">
                <h2>Specification Coverage</h2>
                <div class="coverage-chart">
                    {self._generate_coverage_html(report.spec_coverage)}
                </div>
            </div>

            {len(report.recommendations) > 0 ? f"""
            <div class="section">
                <div class="recommendations">
                    <h3>📋 Recommendations</h3>
                    <ul>
                        {"".join(f"<li>{rec}</li>" for rec in report.recommendations)}
                    </ul>
                </div>
            </div>
            """ : ""}
        </div>
    </div>
</body>
</html>
"""

        with open(output_path, 'w') as f:
            f.write(html_content)

    def _generate_results_html(self, results: List[ValidationResult]) -> str:
        """Generate HTML for validation results"""
        html = ""

        for result in results:
            status_class = f"status-{result.status.lower()}"
            score_class = "high" if result.score >= 0.8 else "medium" if result.score >= 0.6 else "low"

            html += f"""
            <div class="result-card">
                <div class="result-header">
                    <div class="result-title">{result.component.replace('_', ' ').title()}</div>
                    <div class="status-badge {status_class}">{result.status}</div>
                </div>
                <div class="result-body">
                    <div>Score: <strong>{result.score:.1%}</strong></div>
                    <div class="score-bar">
                        <div class="score-fill" style="width: {result.score * 100}%"></div>
                    </div>
                    {self._generate_metrics_html(result.metrics)}
                    {self._generate_issues_html(result.issues) if result.issues else "<p>No issues found ✅</p>"}
                </div>
            </div>
            """

        return html

    def _generate_metrics_html(self, metrics: Dict[str, Any]) -> str:
        """Generate HTML for metrics display"""
        if not metrics:
            return ""

        html = "<div style='margin-top: 15px;'><strong>Metrics:</strong><ul>"
        for key, value in metrics.items():
            if isinstance(value, float):
                html += f"<li>{key.replace('_', ' ').title()}: {value:.1%}</li>"
            else:
                html += f"<li>{key.replace('_', ' ').title()}: {value}</li>"
        html += "</ul></div>"

        return html

    def _generate_issues_html(self, issues: List[ValidationIssue]) -> str:
        """Generate HTML for issues display"""
        if not issues:
            return ""

        html = "<div class='issues'><strong>Issues:</strong>"
        for issue in issues:
            issue_class = f"issue-{issue.level.value.lower()}"
            html += f"""
            <div class="issue {issue_class}">
                <strong>{issue.level.value}:</strong> {issue.description}
                {f"<br><em>Suggestion: {issue.suggestion}</em>" if issue.suggestion else ""}
            </div>
            """
        html += "</div>"

        return html

    def _generate_coverage_html(self, coverage: Dict[str, float]) -> str:
        """Generate HTML for coverage chart"""
        html = ""
        for component, score in coverage.items():
            score_class = "high" if score >= 0.8 else "medium" if score >= 0.6 else "low"
            html += f"""
            <div class="coverage-item">
                <div>{component.replace('_', ' ').title()}</div>
                <div class="coverage-bar">
                    <div class="coverage-fill {score_class}" style="width: {score * 100}%"></div>
                </div>
                <div>{score:.1%}</div>
            </div>
            """

        return html

    def _get_timestamp(self) -> str:
        """Get current timestamp"""
        import time
        return time.strftime("%Y-%m-%d %H:%M:%S")


# Main execution function
async def main():
    """Main function to run OpenSpec validation"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python openspec_validator.py <project_path>")
        sys.exit(1)

    project_path = sys.argv[1]
    validator = OpenSpecValidator(project_path)

    try:
        report = await validator.validate_all()

        print(f"\nOpenSpec Validation Summary:")
        print(f"Project: {report.project_name}")
        print(f"Overall Score: {report.overall_score:.1%}")
        print(f"Components Validated: {report.total_components}")
        print(f"Critical Issues: {report.critical_issues}")

        if report.recommendations:
            print(f"\nRecommendations:")
            for rec in report.recommendations:
                print(f"- {rec}")

        return report.critical_issues == 0 and report.overall_score >= 0.7

    except Exception as e:
        logger.error(f"OpenSpec validation failed: {e}")
        return False


if __name__ == "__main__":
    import time
    success = asyncio.run(main())
    sys.exit(0 if success else 1)