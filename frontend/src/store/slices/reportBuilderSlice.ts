import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import type { 
  ReportDefinition, 
  ReportSection, 
  Field, 
  Filter,
  DataQuery,
  GridLayout 
} from '../../types';
import { queryExecutor } from '../../services/queryExecutor';

interface ReportBuilderState {
  currentReport: ReportDefinition | null;
  selectedSectionId: string | null;
  isDirty: boolean;
  history: ReportDefinition[];
  historyIndex: number;
  draggedField: Field | null;
  previewData: Record<string, any[]>; // sectionId -> data
}

const initialState: ReportBuilderState = {
  currentReport: null,
  selectedSectionId: null,
  isDirty: false,
  history: [],
  historyIndex: -1,
  draggedField: null,
  previewData: {},
};

// Async thunk for creating a section with an initial field
const createSectionWithField = createAsyncThunk(
  'reportBuilder/createSectionWithField',
  async (
    { field, sectionType = 'table' }: { field: Field; sectionType?: ReportSection['type'] },
    { dispatch, getState }
  ) => {
    const sectionId = uuidv4();
    
    // Determine if field is dimension or measure
    const target: 'dimensions' | 'measures' = 
      field.dataType === 'string' || field.aggregation === 'none'
        ? 'dimensions'
        : 'measures';
    
    // Create the section with the ID
    dispatch(addSection({
      id: sectionId,
      type: sectionType,
      layout: {
        x: 0,
        y: 0,
        w: sectionType === 'table' ? 8 : 6,
        h: sectionType === 'table' ? 8 : 6,
      },
    }));
    
    // Add the field to the section we just created
    dispatch(addFieldToSection({
      sectionId,
      field,
      target,
    }));
    
    return sectionId;
  }
);

const reportBuilderSlice = createSlice({
  name: 'reportBuilder',
  initialState,
  reducers: {
    initializeReport: (state, action: PayloadAction<Partial<ReportDefinition>>) => {
      const newReport: ReportDefinition = {
        id: uuidv4(),
        name: 'New Report',
        sections: [],
        filters: [],
        parameters: [],
        dataSources: [{
          id: 'mock-funds',
          name: 'Fund Data',
          type: 'mock',
          fields: [],
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        ...action.payload,
      };
      
      state.currentReport = newReport;
      state.history = [newReport];
      state.historyIndex = 0;
      state.isDirty = false;
    },
    
    addSection: (state, action: PayloadAction<{
      id?: string;
      type: ReportSection['type'];
      layout: GridLayout;
      parentId?: string;
    }>) => {
      if (!state.currentReport) return;
      
      const newSection: ReportSection = {
        id: action.payload.id || uuidv4(),
        type: action.payload.type,
        layout: action.payload.layout,
        parentId: action.payload.parentId,
        dataQuery: {
          dataSourceId: 'mock-funds',
          dimensions: [],
          measures: [],
          filters: [],
          sorts: [],
          aggregations: [],
        },
      };
      
      if (action.payload.parentId) {
        // Add to parent's children
        const parent = findSection(state.currentReport.sections, action.payload.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(newSection);
        }
      } else {
        // Add to root sections
        state.currentReport.sections.push(newSection);
      }
      
      state.selectedSectionId = newSection.id;
      state.isDirty = true;
      saveToHistory(state);
    },
    
    removeSection: (state, action: PayloadAction<string>) => {
      if (!state.currentReport) return;
      
      const removeFromSections = (sections: ReportSection[]): boolean => {
        const index = sections.findIndex(s => s.id === action.payload);
        if (index !== -1) {
          sections.splice(index, 1);
          return true;
        }
        
        for (const section of sections) {
          if (section.children && removeFromSections(section.children)) {
            return true;
          }
        }
        return false;
      };
      
      removeFromSections(state.currentReport.sections);
      
      if (state.selectedSectionId === action.payload) {
        state.selectedSectionId = null;
      }
      
      state.isDirty = true;
      saveToHistory(state);
    },
    
    updateSectionLayout: (state, action: PayloadAction<{
      sectionId: string;
      layout: Partial<GridLayout>;
    }>) => {
      if (!state.currentReport) return;
      
      const section = findSection(state.currentReport.sections, action.payload.sectionId);
      if (section) {
        section.layout = { ...section.layout, ...action.payload.layout };
        state.isDirty = true;
      }
    },
    
    addFieldToSection: (state, action: PayloadAction<{
      sectionId: string;
      field: Field;
      target: 'dimensions' | 'measures';
    }>) => {
      if (!state.currentReport) return;
      
      const section = findSection(state.currentReport.sections, action.payload.sectionId);
      if (section && section.dataQuery) {
        const targetArray = section.dataQuery[action.payload.target];
        
        // Check if field already exists
        if (!targetArray.find(f => f.fieldId === action.payload.field.fieldId)) {
          targetArray.push(action.payload.field);
          state.isDirty = true;
          saveToHistory(state);
        }
      }
    },
    
    removeFieldFromSection: (state, action: PayloadAction<{
      sectionId: string;
      fieldId: string;
      target: 'dimensions' | 'measures';
    }>) => {
      if (!state.currentReport) return;
      
      const section = findSection(state.currentReport.sections, action.payload.sectionId);
      if (section && section.dataQuery) {
        const targetArray = section.dataQuery[action.payload.target];
        const index = targetArray.findIndex(f => f.fieldId === action.payload.fieldId);
        
        if (index !== -1) {
          targetArray.splice(index, 1);
          state.isDirty = true;
          saveToHistory(state);
        }
      }
    },
    
    addFilterToSection: (state, action: PayloadAction<{
      sectionId: string;
      filter: Filter;
    }>) => {
      if (!state.currentReport) return;
      
      const section = findSection(state.currentReport.sections, action.payload.sectionId);
      if (section && section.dataQuery) {
        section.dataQuery.filters.push(action.payload.filter);
        state.isDirty = true;
        saveToHistory(state);
      }
    },
    
    setSelectedSection: (state, action: PayloadAction<string | null>) => {
      state.selectedSectionId = action.payload;
    },
    
    setDraggedField: (state, action: PayloadAction<Field | null>) => {
      state.draggedField = action.payload;
    },
    
    updateSectionData: (state, action: PayloadAction<{
      sectionId: string;
      data: any[];
    }>) => {
      state.previewData[action.payload.sectionId] = action.payload.data;
    },
    
    updateSection: (state, action: PayloadAction<{
      id: string;
      updates: Partial<ReportSection>;
    }>) => {
      if (!state.currentReport) return;
      
      const section = findSection(state.currentReport.sections, action.payload.id);
      if (section) {
        Object.assign(section, action.payload.updates);
        state.isDirty = true;
        saveToHistory(state);
      }
    },
    
    undo: (state) => {
      if (state.historyIndex > 0) {
        state.historyIndex--;
        state.currentReport = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
      }
    },
    
    redo: (state) => {
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        state.currentReport = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
      }
    },
    
    saveReport: (state) => {
      if (state.currentReport) {
        state.currentReport.updatedAt = new Date().toISOString();
        state.currentReport.version++;
        state.isDirty = false;
        
        // Save to localStorage for now
        const savedReports = JSON.parse(localStorage.getItem('savedReports') || '[]');
        const index = savedReports.findIndex((r: ReportDefinition) => r.id === state.currentReport?.id);
        
        if (index !== -1) {
          savedReports[index] = state.currentReport;
        } else {
          savedReports.push(state.currentReport);
        }
        
        localStorage.setItem('savedReports', JSON.stringify(savedReports));
      }
    },
    
    loadReport: (state, action: PayloadAction<ReportDefinition>) => {
      state.currentReport = action.payload;
      state.history = [action.payload];
      state.historyIndex = 0;
      state.isDirty = false;
      state.selectedSectionId = null;
      state.previewData = {};
    },
  },
});

// Helper functions
function findSection(sections: ReportSection[], id: string): ReportSection | null {
  for (const section of sections) {
    if (section.id === id) return section;
    if (section.children) {
      const found = findSection(section.children, id);
      if (found) return found;
    }
  }
  return null;
}

function saveToHistory(state: ReportBuilderState) {
  if (!state.currentReport) return;
  
  // Remove any history after current index
  state.history = state.history.slice(0, state.historyIndex + 1);
  
  // Add current state to history
  const historyCopy = JSON.parse(JSON.stringify(state.currentReport));
  state.history.push(historyCopy);
  state.historyIndex++;
  
  // Limit history to 50 items
  if (state.history.length > 50) {
    state.history = state.history.slice(-50);
    state.historyIndex = state.history.length - 1;
  }
}

export const {
  initializeReport,
  addSection,
  removeSection,
  updateSectionLayout,
  addFieldToSection,
  removeFieldFromSection,
  addFilterToSection,
  setSelectedSection,
  setDraggedField,
  updateSectionData,
  updateSection,
  undo,
  redo,
  saveReport,
  loadReport,
} = reportBuilderSlice.actions;

// Export the thunk
export { createSectionWithField };

export default reportBuilderSlice.reducer;