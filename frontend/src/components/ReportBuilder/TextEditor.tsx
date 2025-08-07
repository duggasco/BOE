import React, { useState, useEffect } from 'react';
import { Button, Typography } from 'antd';
import { EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

interface TextEditorProps {
  content: string;
  onChange?: (content: string) => void;
  editable?: boolean;
  style?: React.CSSProperties;
}

/**
 * Ultra-lightweight text editor for Phase 1
 * - Simple textarea for editing
 * - Basic markdown parsing (headers, bold, italic)
 * - No external dependencies beyond Ant Design
 * 
 * TODO Phase 3 Enhancements:
 * - Rich text editor (consider Tiptap or similar)
 * - Inline formatting for selected text
 * - Data binding to report fields
 * - Tables, lists, hyperlinks
 * - Export formatting preservation
 */
const TextEditor: React.FC<TextEditorProps> = ({
  content = '',
  onChange,
  editable = false,
  style = {},
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  useEffect(() => {
    setEditContent(content);
  }, [content]);

  const handleSave = () => {
    onChange?.(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  /**
   * Simple markdown parser for Phase 1
   * Supports:
   * - Headers: # ## ###
   * - Bold: **text**
   * - Italic: *text*
   * 
   * TODO Phase 3: Use proper markdown parser or rich text
   */
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    
    return lines.map((line, index) => {
      // Headers
      if (line.startsWith('### ')) {
        return <Title key={index} level={5}>{line.substring(4)}</Title>;
      }
      if (line.startsWith('## ')) {
        return <Title key={index} level={4}>{line.substring(3)}</Title>;
      }
      if (line.startsWith('# ')) {
        return <Title key={index} level={3}>{line.substring(2)}</Title>;
      }
      
      // Process inline formatting
      let processedLine = line;
      
      // Bold - **text**
      processedLine = processedLine.replace(
        /\*\*([^*]+)\*\*/g,
        '<strong>$1</strong>'
      );
      
      // Italic - *text*
      processedLine = processedLine.replace(
        /\*([^*]+)\*/g,
        '<em>$1</em>'
      );
      
      // Regular paragraph with inline HTML
      if (line.trim()) {
        return (
          <Paragraph 
            key={index} 
            style={{ margin: '8px 0' }}
            dangerouslySetInnerHTML={{ __html: processedLine }}
          />
        );
      }
      
      // Empty line
      return <br key={index} />;
    });
  };

  if (isEditing) {
    return (
      <div style={{ padding: '12px', ...style }}>
        <div style={{ marginBottom: '8px' }}>
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleSave}
            style={{ marginRight: '8px' }}
          >
            Save
          </Button>
          <Button
            size="small"
            icon={<CloseOutlined />}
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </div>
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          style={{
            width: '100%',
            minHeight: '200px',
            padding: '8px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'monospace',
            resize: 'vertical',
          }}
          placeholder="Enter text content...&#10;&#10;Markdown supported:&#10;# Header 1&#10;## Header 2&#10;### Header 3&#10;**bold text**&#10;*italic text*"
        />
        <div style={{ 
          marginTop: '4px', 
          fontSize: '12px', 
          color: '#999' 
        }}>
          Tip: Use # for headers, **text** for bold, *text* for italic
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '60px', 
      padding: '12px',
      position: 'relative',
      ...style 
    }}>
      {content ? (
        parseMarkdown(content)
      ) : (
        <Paragraph type="secondary" style={{ fontStyle: 'italic' }}>
          Click edit to add text content...
        </Paragraph>
      )}
      
      {editable && !isEditing && (
        <Button
          icon={<EditOutlined />}
          size="small"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            opacity: 0.7,
          }}
          onClick={() => setIsEditing(true)}
        >
          Edit
        </Button>
      )}
    </div>
  );
};

export default TextEditor;