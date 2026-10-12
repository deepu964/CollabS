import mammoth from 'mammoth';
import { marked } from 'marked';

// Configure marked with Github Flavored Markdown & breaks
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Parse an uploaded document file (.docx, .md, .txt) into clean rendered HTML and raw text
 * @param {File} file
 * @returns {Promise<{ title: string, html: string, rawContent: string, format: string }>}
 */
export async function parseDocFile(file) {
  if (!file) throw new Error('No file provided');

  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase();
  const defaultTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value;
    
    // Provide both rendered HTML and a clean fallback
    return {
      title: defaultTitle,
      html,
      rawContent: html,
      format: 'docx',
      messages: result.messages || []
    };
  } else if (extension === 'md' || extension === 'markdown') {
    const text = await file.text();
    const html = marked.parse(text);
    return {
      title: defaultTitle,
      html,
      rawContent: text,
      format: 'markdown'
    };
  } else if (extension === 'txt') {
    const text = await file.text();
    // Convert plain text paragraphs into clean markdown then HTML
    const formattedMarkdown = text
      .split(/\r?\n\r?\n/)
      .map(p => p.trim())
      .filter(Boolean)
      .join('\n\n');
    const html = marked.parse(formattedMarkdown);
    return {
      title: defaultTitle,
      html,
      rawContent: text,
      format: 'text'
    };
  } else if (extension === 'pdf') {
    const blobUrl = URL.createObjectURL(file);
    return {
      title: defaultTitle,
      html: '',
      rawContent: `PDF Document: ${file.name}`,
      format: 'pdf',
      isPdf: true,
      fileUrl: blobUrl
    };
  } else {
    // Attempt text fallback
    const text = await file.text();
    const html = marked.parse(text);
    return {
      title: defaultTitle,
      html,
      rawContent: text,
      format: 'unknown'
    };
  }
}

/**
 * Render any raw markdown string into clean HTML without symbols
 */
export function renderMarkdown(markdownText) {
  if (!markdownText) return '';
  return marked.parse(markdownText);
}
