"""
Security Service for input validation and injection prevention
"""

import re
from typing import Any, List, Optional, Dict
from uuid import UUID
import logging

logger = logging.getLogger(__name__)


class SecurityService:
    """
    Comprehensive security service for input validation and injection prevention
    """
    
    # SQL injection patterns
    SQL_INJECTION_PATTERNS = [
        # SQL commands
        r'\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b',
        r'\b(UNION|JOIN|FROM|WHERE|HAVING|GROUP BY|ORDER BY)\b',
        # SQL functions that could be exploited
        r'\b(CONCAT|CHAR|CHR|ASCII|SUBSTRING|LENGTH|CAST|CONVERT)\b',
        # SQL operators and syntax
        r'(--|#|/\*|\*/|;|\|\||&&)',
        r"('|\"|`|\\x[0-9a-fA-F]{2}|\\[0-7]{1,3})",
        # Common injection patterns
        r"(\bOR\b\s*['\"]?\s*[0-9a-zA-Z]+\s*['\"]?\s*=\s*['\"]?\s*[0-9a-zA-Z]+)",
        r"(\bAND\b\s*['\"]?\s*[0-9a-zA-Z]+\s*['\"]?\s*=\s*['\"]?\s*[0-9a-zA-Z]+)",
        # Time-based blind SQL injection
        r'\b(SLEEP|WAITFOR|PG_SLEEP|BENCHMARK)\b',
        # Stacked queries
        r';\s*(SELECT|INSERT|UPDATE|DELETE|DROP)',
    ]
    
    # XSS patterns
    XSS_PATTERNS = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        r'<iframe[^>]*>',
        r'<embed[^>]*>',
        r'<object[^>]*>',
        r'eval\s*\(',
        r'Function\s*\(',
        r'setTimeout\s*\(',
        r'setInterval\s*\(',
        r'__proto__',
        r'constructor\[',
        r'document\.(cookie|write|location)',
        r'window\.(location|open)',
    ]
    
    # Command injection patterns
    COMMAND_INJECTION_PATTERNS = [
        r'\$\(.*\)',  # Command substitution
        r'`.*`',      # Backticks
        r'\|',        # Pipe
        r'&&',        # Command chaining
        r';',         # Command separator
        r'>',         # Redirect
        r'<',         # Input redirect
        r'\.\.',     # Directory traversal
    ]
    
    # Path traversal patterns
    PATH_TRAVERSAL_PATTERNS = [
        r'\.\./\.\./',
        r'\.\.[/\\]',
        r'\.\.%2[fF]',
        r'%2e%2e[/\\]',
        r'/etc/passwd',
        r'C:\\Windows\\',
        r'file:///',
    ]
    
    @classmethod
    def validate_sql_safe(cls, value: Any, field_name: str = "input") -> List[str]:
        """
        Validate input for SQL injection attempts
        
        Args:
            value: Input value to validate
            field_name: Name of the field being validated
            
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        if value is None:
            return errors
        
        # Convert to string for pattern matching
        str_value = str(value) if not isinstance(value, str) else value
        
        # Check for SQL injection patterns
        for pattern in cls.SQL_INJECTION_PATTERNS:
            if re.search(pattern, str_value, re.IGNORECASE):
                errors.append(f"Potential SQL injection in {field_name}: pattern detected")
                logger.warning(f"SQL injection attempt detected in {field_name}: {pattern}")
                break  # One error is enough
        
        return errors
    
    @classmethod
    def validate_xss_safe(cls, value: Any, field_name: str = "input") -> List[str]:
        """
        Validate input for XSS attempts
        
        Args:
            value: Input value to validate
            field_name: Name of the field being validated
            
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        if value is None:
            return errors
        
        # Convert to string for pattern matching
        str_value = str(value) if not isinstance(value, str) else value
        
        # Check for XSS patterns
        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, str_value, re.IGNORECASE):
                errors.append(f"Potential XSS attack in {field_name}: script pattern detected")
                logger.warning(f"XSS attempt detected in {field_name}: {pattern}")
                break
        
        return errors
    
    @classmethod
    def validate_command_safe(cls, value: Any, field_name: str = "input") -> List[str]:
        """
        Validate input for command injection attempts
        
        Args:
            value: Input value to validate
            field_name: Name of the field being validated
            
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        if value is None:
            return errors
        
        # Convert to string for pattern matching
        str_value = str(value) if not isinstance(value, str) else value
        
        # Check for command injection patterns
        for pattern in cls.COMMAND_INJECTION_PATTERNS:
            if re.search(pattern, str_value):
                errors.append(f"Potential command injection in {field_name}: dangerous character detected")
                logger.warning(f"Command injection attempt detected in {field_name}: {pattern}")
                break
        
        return errors
    
    @classmethod
    def validate_path_safe(cls, value: Any, field_name: str = "input") -> List[str]:
        """
        Validate input for path traversal attempts
        
        Args:
            value: Input value to validate
            field_name: Name of the field being validated
            
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        if value is None:
            return errors
        
        # Convert to string for pattern matching
        str_value = str(value) if not isinstance(value, str) else value
        
        # Check for path traversal patterns
        for pattern in cls.PATH_TRAVERSAL_PATTERNS:
            if re.search(pattern, str_value, re.IGNORECASE):
                errors.append(f"Potential path traversal in {field_name}: dangerous path detected")
                logger.warning(f"Path traversal attempt detected in {field_name}: {pattern}")
                break
        
        return errors
    
    @classmethod
    def validate_all(cls, value: Any, field_name: str = "input") -> List[str]:
        """
        Perform all security validations on input
        
        Args:
            value: Input value to validate
            field_name: Name of the field being validated
            
        Returns:
            List of all validation errors (empty if valid)
        """
        errors = []
        
        errors.extend(cls.validate_sql_safe(value, field_name))
        errors.extend(cls.validate_xss_safe(value, field_name))
        errors.extend(cls.validate_command_safe(value, field_name))
        errors.extend(cls.validate_path_safe(value, field_name))
        
        return errors
    
    @classmethod
    def sanitize_string(cls, value: str, allow_html: bool = False) -> str:
        """
        Sanitize a string value by removing or escaping dangerous content
        
        Args:
            value: String to sanitize
            allow_html: Whether to allow HTML tags
            
        Returns:
            Sanitized string
        """
        if not value:
            return value
        
        # Remove null bytes
        sanitized = value.replace('\x00', '')
        
        # HTML entity encoding
        if not allow_html:
            html_entities = {
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '&': '&amp;',
                '/': '&#x2F;',
            }
            for char, entity in html_entities.items():
                sanitized = sanitized.replace(char, entity)
        
        # Remove control characters (except newline and tab)
        sanitized = ''.join(char for char in sanitized 
                          if char == '\n' or char == '\t' or not ord(char) < 32)
        
        return sanitized
    
    @classmethod
    def validate_uuid(cls, value: Any, field_name: str = "id") -> List[str]:
        """
        Validate that a value is a valid UUID
        
        Args:
            value: Value to validate
            field_name: Name of the field being validated
            
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        try:
            if isinstance(value, str):
                UUID(value)
            elif not isinstance(value, UUID):
                errors.append(f"{field_name} must be a valid UUID")
        except (ValueError, AttributeError):
            errors.append(f"{field_name} is not a valid UUID format")
        
        return errors
    
    @classmethod
    def validate_json_safe(cls, obj: Dict, path: str = "") -> List[str]:
        """
        Recursively validate JSON object for injection attempts
        
        Args:
            obj: JSON object to validate
            path: Current path in the object (for error reporting)
            
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        if isinstance(obj, dict):
            for key, value in obj.items():
                # Validate the key itself
                key_errors = cls.validate_all(key, f"{path}.{key}" if path else key)
                errors.extend(key_errors)
                
                # Recursively validate the value
                if isinstance(value, (dict, list)):
                    errors.extend(cls.validate_json_safe(value, f"{path}.{key}" if path else key))
                else:
                    value_errors = cls.validate_all(value, f"{path}.{key}" if path else key)
                    errors.extend(value_errors)
                    
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                if isinstance(item, (dict, list)):
                    errors.extend(cls.validate_json_safe(item, f"{path}[{i}]"))
                else:
                    item_errors = cls.validate_all(item, f"{path}[{i}]")
                    errors.extend(item_errors)
        else:
            errors.extend(cls.validate_all(obj, path))
        
        return errors
    
    @classmethod
    def validate_report_query(cls, query: str) -> List[str]:
        """
        Validate a report query for safety
        
        Args:
            query: SQL query string
            
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        # Queries should only contain SELECT statements
        if not re.match(r'^\s*SELECT\b', query, re.IGNORECASE):
            errors.append("Report queries must start with SELECT")
        
        # Check for dangerous keywords
        dangerous_keywords = [
            'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
            'EXEC', 'EXECUTE', 'GRANT', 'REVOKE', 'TRUNCATE'
        ]
        
        for keyword in dangerous_keywords:
            if re.search(r'\b' + keyword + r'\b', query, re.IGNORECASE):
                errors.append(f"Dangerous keyword '{keyword}' not allowed in report queries")
        
        # Check for multiple statements
        if ';' in query:
            # Allow semicolon only at the very end
            if not re.match(r'^[^;]+;?\s*$', query):
                errors.append("Multiple SQL statements not allowed")
        
        # Check for comments (could hide malicious code)
        if '--' in query or '/*' in query:
            errors.append("SQL comments not allowed in report queries")
        
        return errors
    
    @classmethod
    def escape_sql_identifier(cls, identifier: str) -> str:
        """
        Escape a SQL identifier (table/column name)
        
        Args:
            identifier: Identifier to escape
            
        Returns:
            Escaped identifier safe for SQL
        """
        # Remove any quotes first
        identifier = identifier.replace('"', '').replace('`', '').replace("'", '')
        
        # Only allow alphanumeric and underscore
        safe_identifier = re.sub(r'[^\w]', '', identifier)
        
        # Wrap in quotes for safety
        return f'"{safe_identifier}"'
    
    @classmethod
    def validate_filter_value(cls, value: Any, operator: str) -> List[str]:
        """
        Validate a filter value based on its operator
        
        Args:
            value: Filter value
            operator: Filter operator (e.g., '=', 'IN', 'LIKE')
            
        Returns:
            List of validation errors
        """
        errors = []
        
        if operator == 'IN':
            if not isinstance(value, list):
                errors.append("IN operator requires a list value")
            elif len(value) > 100:
                errors.append(f"IN operator limited to 100 values, got {len(value)}")
            else:
                for item in value:
                    errors.extend(cls.validate_sql_safe(item, "IN value"))
                    
        elif operator == 'BETWEEN':
            if not isinstance(value, list) or len(value) != 2:
                errors.append("BETWEEN operator requires exactly 2 values")
            else:
                for item in value:
                    errors.extend(cls.validate_sql_safe(item, "BETWEEN value"))
                    
        elif operator == 'LIKE':
            if isinstance(value, str):
                # LIKE patterns can contain % and _ wildcards, but check for other injections
                safe_value = value.replace('%', '').replace('_', '')
                errors.extend(cls.validate_sql_safe(safe_value, "LIKE pattern"))
            else:
                errors.append("LIKE operator requires a string value")
                
        else:
            # For other operators, just validate the value
            errors.extend(cls.validate_sql_safe(value, "filter value"))
        
        return errors