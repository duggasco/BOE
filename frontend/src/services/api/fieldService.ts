/**
 * Field Service
 * Handles field metadata and relationships
 */

import { api } from './client';

// Types
export type Field = {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  data_type: 'string' | 'number' | 'date' | 'boolean' | 'datetime' | 'time';
  field_type: 'dimension' | 'measure' | 'calculated';
  table_id: string;
  source_column?: string;
  calculation_formula?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct';
  format?: string;
  is_visible: boolean;
  is_filterable: boolean;
  is_sortable: boolean;
  category?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  semantic_type?: 'currency' | 'percentage' | 'identifier' | 'metric' | 'dimension';
  unit?: string;
  table?: DataTable;
};

export interface DataTable {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  datasource_id: string;
  schema_name?: string;
  is_active: boolean;
  fields?: Field[];
  datasource?: DataSource;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'oracle' | 'sqlserver' | 'snowflake';
  connection_string?: string;
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
  is_active: boolean;
  tables?: DataTable[];
}

export interface FieldRelationship {
  id: string;
  source_field_id: string;
  target_field_id: string;
  relationship_type: 'one_to_one' | 'one_to_many' | 'many_to_many';
  join_type?: 'inner' | 'left' | 'right' | 'full';
  is_active: boolean;
  source_field?: Field;
  target_field?: Field;
}

export interface FieldHierarchy {
  category: string;
  fields: Field[];
  subcategories?: FieldHierarchy[];
}

export interface FieldListParams {
  table_id?: string;
  field_type?: 'dimension' | 'measure' | 'calculated';
  is_visible?: boolean;
  category?: string;
  search?: string;
}

class FieldService {
  /**
   * List all fields with optional filters
   */
  async listFields(params?: FieldListParams): Promise<Field[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.table_id) queryParams.append('table_id', params.table_id);
      if (params?.field_type) queryParams.append('field_type', params.field_type);
      if (params?.is_visible !== undefined) queryParams.append('is_visible', params.is_visible.toString());
      if (params?.category) queryParams.append('category', params.category);
      if (params?.search) queryParams.append('search', params.search);
      
      const fields = await api.get<Field[]>(`/fields?${queryParams.toString()}`);
      return fields;
    } catch (error: any) {
      console.error('[List Fields Error]', error);
      throw new Error(error.message || 'Failed to list fields');
    }
  }

  /**
   * Get a specific field by ID
   */
  async getField(fieldId: string): Promise<Field> {
    try {
      const field = await api.get<Field>(`/fields/${fieldId}`);
      return field;
    } catch (error: any) {
      console.error('[Get Field Error]', error);
      if (error.status === 404) {
        throw new Error('Field not found');
      }
      throw new Error(error.message || 'Failed to get field');
    }
  }

  /**
   * Get field hierarchy organized by categories
   */
  async getFieldHierarchy(): Promise<FieldHierarchy[]> {
    try {
      // First get all fields
      const fields = await this.listFields({ is_visible: true });
      
      // Organize into hierarchy
      const hierarchy: Map<string, FieldHierarchy> = new Map();
      
      fields.forEach(field => {
        const category = field.category || 'Uncategorized';
        
        if (!hierarchy.has(category)) {
          hierarchy.set(category, {
            category,
            fields: []
          });
        }
        
        hierarchy.get(category)!.fields.push(field);
      });
      
      // Convert to array and sort
      return Array.from(hierarchy.values()).sort((a, b) => 
        a.category.localeCompare(b.category)
      );
    } catch (error: any) {
      console.error('[Get Field Hierarchy Error]', error);
      throw new Error(error.message || 'Failed to get field hierarchy');
    }
  }

  /**
   * Get all data tables
   */
  async listTables(): Promise<DataTable[]> {
    try {
      const tables = await api.get<DataTable[]>('/fields/tables');
      return tables;
    } catch (error: any) {
      console.error('[List Tables Error]', error);
      throw new Error(error.message || 'Failed to list tables');
    }
  }

  /**
   * Get all data sources
   */
  async listDataSources(): Promise<DataSource[]> {
    try {
      const sources = await api.get<DataSource[]>('/fields/datasources');
      return sources;
    } catch (error: any) {
      console.error('[List Data Sources Error]', error);
      throw new Error(error.message || 'Failed to list data sources');
    }
  }

  /**
   * Get field relationships
   */
  async getFieldRelationships(): Promise<FieldRelationship[]> {
    try {
      const relationships = await api.get<FieldRelationship[]>('/fields/relationships');
      return relationships;
    } catch (error: any) {
      console.error('[Get Field Relationships Error]', error);
      throw new Error(error.message || 'Failed to get field relationships');
    }
  }

  /**
   * Transform fields to match frontend format
   */
  transformFieldsForFrontend(fields: Field[]): any[] {
    return fields.map(field => ({
      id: field.id,
      name: field.name,
      displayName: field.display_name,
      type: field.field_type,
      dataType: field.data_type,
      category: field.category || 'Uncategorized',
      description: field.description,
      aggregation: field.aggregation,
      format: field.format,
      semanticType: field.semantic_type,
      unit: field.unit,
      isFilterable: field.is_filterable,
      isSortable: field.is_sortable,
      // Additional properties for compatibility
      icon: field.field_type === 'measure' ? 'number' : 'font-size',
      isDraggable: true,
    }));
  }

  /**
   * Get fields by category
   */
  async getFieldsByCategory(category: string): Promise<Field[]> {
    try {
      const fields = await this.listFields({ category, is_visible: true });
      return fields;
    } catch (error: any) {
      console.error('[Get Fields By Category Error]', error);
      throw new Error(error.message || 'Failed to get fields by category');
    }
  }

  /**
   * Search fields
   */
  async searchFields(searchTerm: string): Promise<Field[]> {
    try {
      const fields = await this.listFields({ search: searchTerm, is_visible: true });
      return fields;
    } catch (error: any) {
      console.error('[Search Fields Error]', error);
      throw new Error(error.message || 'Failed to search fields');
    }
  }

  /**
   * Get calculated fields
   */
  async getCalculatedFields(): Promise<Field[]> {
    try {
      const fields = await this.listFields({ field_type: 'calculated', is_visible: true });
      return fields;
    } catch (error: any) {
      console.error('[Get Calculated Fields Error]', error);
      throw new Error(error.message || 'Failed to get calculated fields');
    }
  }
}

// Export singleton instance
export const fieldService = new FieldService();

// Export default
export default fieldService;