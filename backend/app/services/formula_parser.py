"""
Secure Formula Parser Service
Prevents SQL injection by using structured JSON definitions instead of raw SQL strings
"""

from typing import Any, Dict, List, Optional, Union
from enum import Enum
from pydantic import BaseModel, Field, validator
from sqlalchemy import func, case, and_, or_, Column, literal
from sqlalchemy.sql import ClauseElement
import json


class FormulaType(str, Enum):
    """Allowed formula node types"""
    FIELD = "field"
    LITERAL = "literal"
    OPERATOR = "operator"
    FUNCTION = "function"
    AGGREGATION = "aggregation"
    CASE_WHEN = "case_when"


class OperatorType(str, Enum):
    """Allowed operators"""
    ADD = "+"
    SUBTRACT = "-"
    MULTIPLY = "*"
    DIVIDE = "/"
    MODULO = "%"
    EQUALS = "="
    NOT_EQUALS = "!="
    GREATER_THAN = ">"
    LESS_THAN = "<"
    GREATER_EQUAL = ">="
    LESS_EQUAL = "<="
    AND = "and"
    OR = "or"
    NOT = "not"
    IN = "in"
    LIKE = "like"
    IS_NULL = "is_null"
    IS_NOT_NULL = "is_not_null"


class FunctionType(str, Enum):
    """Allowed SQL functions"""
    ABS = "abs"
    ROUND = "round"
    FLOOR = "floor"
    CEILING = "ceiling"
    LENGTH = "length"
    LOWER = "lower"
    UPPER = "upper"
    TRIM = "trim"
    CONCAT = "concat"
    SUBSTRING = "substring"
    COALESCE = "coalesce"
    CAST = "cast"
    DATE_PART = "date_part"
    DATE_TRUNC = "date_trunc"
    NOW = "now"


class AggregationType(str, Enum):
    """Allowed aggregation functions"""
    SUM = "sum"
    AVG = "avg"
    COUNT = "count"
    COUNT_DISTINCT = "count_distinct"
    MIN = "min"
    MAX = "max"
    STDDEV = "stddev"
    VARIANCE = "variance"


class FormulaNode(BaseModel):
    """Base class for formula tree nodes"""
    type: FormulaType
    
    class Config:
        use_enum_values = True


class FieldNode(FormulaNode):
    """Reference to a database field"""
    type: FormulaType = FormulaType.FIELD
    field_id: str = Field(..., description="UUID of the field")
    alias: Optional[str] = None


class LiteralNode(FormulaNode):
    """Literal value (string, number, boolean, null)"""
    type: FormulaType = FormulaType.LITERAL
    value: Union[str, int, float, bool, None]
    data_type: Optional[str] = None  # For explicit casting


class OperatorNode(FormulaNode):
    """Binary or unary operator"""
    type: FormulaType = FormulaType.OPERATOR
    operator: OperatorType
    operands: List['FormulaNodeUnion']  # 1 for unary, 2 for binary
    
    @validator('operands')
    def validate_operand_count(cls, v, values):
        op = values.get('operator')
        if op in [OperatorType.NOT, OperatorType.IS_NULL, OperatorType.IS_NOT_NULL]:
            if len(v) != 1:
                raise ValueError(f"Operator {op} requires exactly 1 operand")
        elif op == OperatorType.IN:
            if len(v) < 2:
                raise ValueError(f"Operator {op} requires at least 2 operands")
            # Limit IN operator to prevent DoS attacks
            if len(v) > 100:  # Maximum 99 values + 1 field reference
                raise ValueError(f"Operator {op} cannot have more than 99 values")
        else:
            if len(v) != 2:
                raise ValueError(f"Operator {op} requires exactly 2 operands")
        return v


class FunctionNode(FormulaNode):
    """SQL function call"""
    type: FormulaType = FormulaType.FUNCTION
    function: FunctionType
    arguments: List['FormulaNodeUnion']
    
    @validator('arguments')
    def validate_argument_count(cls, v, values):
        func = values.get('function')
        # Validate argument counts for specific functions
        if func == FunctionType.NOW and len(v) != 0:
            raise ValueError(f"Function {func} takes no arguments")
        elif func in [FunctionType.ABS, FunctionType.LENGTH, FunctionType.LOWER, 
                      FunctionType.UPPER, FunctionType.TRIM] and len(v) != 1:
            raise ValueError(f"Function {func} requires exactly 1 argument")
        elif func == FunctionType.ROUND and len(v) not in [1, 2]:
            raise ValueError(f"Function {func} requires 1 or 2 arguments")
        elif func == FunctionType.SUBSTRING and len(v) not in [2, 3]:
            raise ValueError(f"Function {func} requires 2 or 3 arguments")
        return v


class AggregationNode(FormulaNode):
    """Aggregation function"""
    type: FormulaType = FormulaType.AGGREGATION
    aggregation: AggregationType
    expression: 'FormulaNodeUnion'
    filter: Optional['FormulaNodeUnion'] = None  # Optional WHERE clause for aggregation


class CaseWhenNode(FormulaNode):
    """CASE WHEN expression"""
    type: FormulaType = FormulaType.CASE_WHEN
    conditions: List[Dict[str, 'FormulaNodeUnion']]  # List of {"when": condition, "then": result}
    else_result: Optional['FormulaNodeUnion'] = None


# Union type for recursive definitions
FormulaNodeUnion = Union[
    FieldNode, 
    LiteralNode, 
    OperatorNode, 
    FunctionNode, 
    AggregationNode, 
    CaseWhenNode
]

# Update forward references
OperatorNode.model_rebuild()
FunctionNode.model_rebuild()
AggregationNode.model_rebuild()
CaseWhenNode.model_rebuild()


class FormulaDefinition(BaseModel):
    """Complete formula definition"""
    name: str
    description: Optional[str] = None
    formula: FormulaNodeUnion
    
    def to_dict(self) -> dict:
        """Convert to dictionary for storage"""
        return self.dict()
    
    @classmethod
    def from_dict(cls, data: dict) -> 'FormulaDefinition':
        """Create from dictionary"""
        return cls(**data)
    
    @classmethod
    def from_json(cls, json_str: str) -> 'FormulaDefinition':
        """Create from JSON string"""
        return cls(**json.loads(json_str))


class SecureFormulaParser:
    """
    Secure formula parser that converts JSON formula definitions to SQLAlchemy expressions
    Prevents SQL injection by only allowing predefined operations
    """
    
    MAX_RECURSION_DEPTH = 50  # Prevent deep recursion DoS attacks
    
    def __init__(self, field_columns: Dict[str, Column]):
        """
        Initialize parser with available columns
        
        Args:
            field_columns: Mapping of field IDs to SQLAlchemy Column objects
        """
        self.field_columns = field_columns
        self._recursion_depth = 0
    
    def parse(self, formula_def: FormulaDefinition) -> ClauseElement:
        """
        Parse a formula definition into a SQLAlchemy expression
        
        Args:
            formula_def: The formula definition to parse
            
        Returns:
            SQLAlchemy expression that can be used in queries
            
        Raises:
            ValueError: If the formula contains invalid references or operations
        """
        return self._parse_node(formula_def.formula)
    
    def _parse_node(self, node: FormulaNodeUnion) -> ClauseElement:
        """Recursively parse formula nodes with depth protection"""
        # Check recursion depth to prevent DoS
        self._recursion_depth += 1
        if self._recursion_depth > self.MAX_RECURSION_DEPTH:
            raise ValueError(f"Formula exceeds maximum complexity (depth > {self.MAX_RECURSION_DEPTH})")
        
        try:
            if isinstance(node, dict):
                # Handle dict representation
                node_type = node.get('type')
                if node_type == FormulaType.FIELD:
                    node = FieldNode(**node)
                elif node_type == FormulaType.LITERAL:
                    node = LiteralNode(**node)
                elif node_type == FormulaType.OPERATOR:
                    node = OperatorNode(**node)
                elif node_type == FormulaType.FUNCTION:
                    node = FunctionNode(**node)
                elif node_type == FormulaType.AGGREGATION:
                    node = AggregationNode(**node)
                elif node_type == FormulaType.CASE_WHEN:
                    node = CaseWhenNode(**node)
                else:
                    raise ValueError(f"Unknown node type: {node_type}")
            
            if isinstance(node, FieldNode):
                return self._parse_field(node)
            elif isinstance(node, LiteralNode):
                return self._parse_literal(node)
            elif isinstance(node, OperatorNode):
                return self._parse_operator(node)
            elif isinstance(node, FunctionNode):
                return self._parse_function(node)
            elif isinstance(node, AggregationNode):
                return self._parse_aggregation(node)
            elif isinstance(node, CaseWhenNode):
                return self._parse_case_when(node)
            else:
                raise ValueError(f"Unknown node type: {type(node)}")
        finally:
            # Always decrease recursion depth
            self._recursion_depth -= 1
    
    def _parse_field(self, node: FieldNode) -> Column:
        """Parse field reference"""
        if node.field_id not in self.field_columns:
            raise ValueError(f"Unknown field ID: {node.field_id}")
        
        column = self.field_columns[node.field_id]
        if node.alias:
            return column.label(node.alias)
        return column
    
    def _parse_literal(self, node: LiteralNode) -> ClauseElement:
        """Parse literal value"""
        value = literal(node.value)
        
        # Apply explicit casting if specified
        if node.data_type:
            # Map common data types to SQLAlchemy types
            from sqlalchemy import Integer, Float, String, Boolean, Date, DateTime
            
            type_map = {
                'integer': Integer,
                'float': Float,
                'string': String,
                'boolean': Boolean,
                'date': Date,
                'datetime': DateTime,
            }
            
            sql_type = type_map.get(node.data_type.lower())
            if sql_type:
                value = func.cast(value, sql_type)
        
        return value
    
    def _parse_operator(self, node: OperatorNode) -> ClauseElement:
        """Parse operator expression"""
        operands = [self._parse_node(op) for op in node.operands]
        
        # Binary operators
        if node.operator == OperatorType.ADD:
            return operands[0] + operands[1]
        elif node.operator == OperatorType.SUBTRACT:
            return operands[0] - operands[1]
        elif node.operator == OperatorType.MULTIPLY:
            return operands[0] * operands[1]
        elif node.operator == OperatorType.DIVIDE:
            return operands[0] / operands[1]
        elif node.operator == OperatorType.MODULO:
            return operands[0] % operands[1]
        elif node.operator == OperatorType.EQUALS:
            return operands[0] == operands[1]
        elif node.operator == OperatorType.NOT_EQUALS:
            return operands[0] != operands[1]
        elif node.operator == OperatorType.GREATER_THAN:
            return operands[0] > operands[1]
        elif node.operator == OperatorType.LESS_THAN:
            return operands[0] < operands[1]
        elif node.operator == OperatorType.GREATER_EQUAL:
            return operands[0] >= operands[1]
        elif node.operator == OperatorType.LESS_EQUAL:
            return operands[0] <= operands[1]
        elif node.operator == OperatorType.AND:
            return and_(*operands)
        elif node.operator == OperatorType.OR:
            return or_(*operands)
        elif node.operator == OperatorType.NOT:
            return ~operands[0]
        elif node.operator == OperatorType.IN:
            return operands[0].in_(operands[1:])
        elif node.operator == OperatorType.LIKE:
            return operands[0].like(operands[1])
        elif node.operator == OperatorType.IS_NULL:
            return operands[0].is_(None)
        elif node.operator == OperatorType.IS_NOT_NULL:
            return operands[0].isnot(None)
        else:
            raise ValueError(f"Unknown operator: {node.operator}")
    
    def _parse_function(self, node: FunctionNode) -> ClauseElement:
        """Parse function call"""
        args = [self._parse_node(arg) for arg in node.arguments]
        
        if node.function == FunctionType.ABS:
            return func.abs(args[0])
        elif node.function == FunctionType.ROUND:
            return func.round(*args)
        elif node.function == FunctionType.FLOOR:
            return func.floor(args[0])
        elif node.function == FunctionType.CEILING:
            return func.ceiling(args[0])
        elif node.function == FunctionType.LENGTH:
            return func.length(args[0])
        elif node.function == FunctionType.LOWER:
            return func.lower(args[0])
        elif node.function == FunctionType.UPPER:
            return func.upper(args[0])
        elif node.function == FunctionType.TRIM:
            return func.trim(args[0])
        elif node.function == FunctionType.CONCAT:
            return func.concat(*args)
        elif node.function == FunctionType.SUBSTRING:
            return func.substring(*args)
        elif node.function == FunctionType.COALESCE:
            return func.coalesce(*args)
        elif node.function == FunctionType.CAST:
            # Requires special handling - second argument should be a type
            return func.cast(args[0], args[1])
        elif node.function == FunctionType.DATE_PART:
            return func.date_part(args[0], args[1])
        elif node.function == FunctionType.DATE_TRUNC:
            return func.date_trunc(args[0], args[1])
        elif node.function == FunctionType.NOW:
            return func.now()
        else:
            raise ValueError(f"Unknown function: {node.function}")
    
    def _parse_aggregation(self, node: AggregationNode) -> ClauseElement:
        """Parse aggregation function"""
        expr = self._parse_node(node.expression)
        
        if node.aggregation == AggregationType.SUM:
            result = func.sum(expr)
        elif node.aggregation == AggregationType.AVG:
            result = func.avg(expr)
        elif node.aggregation == AggregationType.COUNT:
            result = func.count(expr)
        elif node.aggregation == AggregationType.COUNT_DISTINCT:
            result = func.count(func.distinct(expr))
        elif node.aggregation == AggregationType.MIN:
            result = func.min(expr)
        elif node.aggregation == AggregationType.MAX:
            result = func.max(expr)
        elif node.aggregation == AggregationType.STDDEV:
            result = func.stddev(expr)
        elif node.aggregation == AggregationType.VARIANCE:
            result = func.variance(expr)
        else:
            raise ValueError(f"Unknown aggregation: {node.aggregation}")
        
        # Apply filter if specified (PostgreSQL FILTER clause)
        if node.filter:
            filter_expr = self._parse_node(node.filter)
            result = result.filter(filter_expr)
        
        return result
    
    def _parse_case_when(self, node: CaseWhenNode) -> ClauseElement:
        """Parse CASE WHEN expression"""
        case_args = []
        
        for condition in node.conditions:
            when_expr = self._parse_node(condition['when'])
            then_expr = self._parse_node(condition['then'])
            case_args.append((when_expr, then_expr))
        
        if node.else_result:
            else_expr = self._parse_node(node.else_result)
            return case(*case_args, else_=else_expr)
        else:
            return case(*case_args)


# Example usage and validation
def create_example_formulas() -> List[FormulaDefinition]:
    """Create example formula definitions for testing"""
    examples = []
    
    # Simple field reference
    examples.append(FormulaDefinition(
        name="Simple Field",
        description="Reference to a single field",
        formula=FieldNode(field_id="field_1", alias="price")
    ))
    
    # Arithmetic expression: price * quantity
    examples.append(FormulaDefinition(
        name="Total Value",
        description="Calculate total value as price * quantity",
        formula=OperatorNode(
            operator=OperatorType.MULTIPLY,
            operands=[
                FieldNode(field_id="price_field"),
                FieldNode(field_id="quantity_field")
            ]
        )
    ))
    
    # Aggregation with filter: SUM(amount) WHERE status = 'active'
    examples.append(FormulaDefinition(
        name="Active Total",
        description="Sum of amounts for active items",
        formula=AggregationNode(
            aggregation=AggregationType.SUM,
            expression=FieldNode(field_id="amount_field"),
            filter=OperatorNode(
                operator=OperatorType.EQUALS,
                operands=[
                    FieldNode(field_id="status_field"),
                    LiteralNode(value="active")
                ]
            )
        )
    ))
    
    # Complex CASE WHEN
    examples.append(FormulaDefinition(
        name="Risk Category",
        description="Categorize risk based on score",
        formula=CaseWhenNode(
            conditions=[
                {
                    "when": OperatorNode(
                        operator=OperatorType.GREATER_EQUAL,
                        operands=[FieldNode(field_id="risk_score"), LiteralNode(value=80)]
                    ),
                    "then": LiteralNode(value="High")
                },
                {
                    "when": OperatorNode(
                        operator=OperatorType.GREATER_EQUAL,
                        operands=[FieldNode(field_id="risk_score"), LiteralNode(value=50)]
                    ),
                    "then": LiteralNode(value="Medium")
                }
            ],
            else_result=LiteralNode(value="Low")
        )
    ))
    
    return examples