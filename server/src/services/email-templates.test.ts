import { describe, it, expect } from 'vitest';
import { renderTemplate, extractPlaceholders, TEMPLATE_EXAMPLES } from './email-templates';

describe('renderTemplate', () => {
  it('replaces {{variable}} placeholders with provided values', () => {
    const result = renderTemplate('Hello {{first_name}}, welcome to {{company}}!', {
      first_name: 'Ankur',
      company: 'PrimeLead',
    });
    expect(result).toBe('Hello Ankur, welcome to PrimeLead!');
  });

  it('keeps placeholder if value is not provided', () => {
    const result = renderTemplate('Hello {{name}}!', {});
    expect(result).toBe('Hello {{name}}!');
  });

  it('handles multiple occurrences of the same variable', () => {
    const result = renderTemplate('{{greeting}} world, {{greeting}}!', {
      greeting: 'Hello',
    });
    expect(result).toBe('Hello world, Hello!');
  });

  it('converts number and boolean values to strings', () => {
    const result = renderTemplate('Count: {{count}}, Active: {{active}}', {
      count: 42,
      active: true,
    });
    expect(result).toBe('Count: 42, Active: true');
  });

  it('handles empty template string', () => {
    const result = renderTemplate('', { name: 'test' });
    expect(result).toBe('');
  });

  it('handles template with no placeholders', () => {
    const result = renderTemplate('No variables here.', { name: 'test' });
    expect(result).toBe('No variables here.');
  });

  it('handles null value as missing (keeps placeholder)', () => {
    const result = renderTemplate('Hello {{name}}!', { name: null as any });
    expect(result).toBe('Hello {{name}}!');
  });
});

describe('extractPlaceholders', () => {
  it('extracts unique placeholder names from content', () => {
    const vars = extractPlaceholders('{{first_name}} and {{last_name}}, your {{company}} awaits {{first_name}}');
    expect(vars).toEqual(['first_name', 'last_name', 'company']);
  });

  it('returns empty array for content with no placeholders', () => {
    const vars = extractPlaceholders('No variables here.');
    expect(vars).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    const vars = extractPlaceholders('');
    expect(vars).toEqual([]);
  });

  it('handles single placeholder', () => {
    const vars = extractPlaceholders('{{name}}');
    expect(vars).toEqual(['name']);
  });

  it('handles underscore and numeric variable names', () => {
    const vars = extractPlaceholders('{{first_name}} {{count2}}');
    expect(vars).toEqual(['first_name', 'count2']);
  });
});

describe('TEMPLATE_EXAMPLES', () => {
  it('has at least 4 pre-built examples', () => {
    expect(TEMPLATE_EXAMPLES.length).toBeGreaterThanOrEqual(4);
  });

  it('each example has valid structure', () => {
    for (const example of TEMPLATE_EXAMPLES) {
      expect(example.name).toBeTruthy();
      expect(example.category).toBeTruthy();
      expect(example.subject).toContain('{{');
      expect(example.htmlContent).toContain('<');
      expect(example.variables.length).toBeGreaterThan(0);

      // Every variable should appear in either subject or htmlContent
      for (const v of example.variables) {
        const placeholder = `{{${v.name}}}`;
        const inSubject = example.subject.includes(placeholder);
        const inHtml = example.htmlContent.includes(placeholder);
        expect(inSubject || inHtml).toBe(true);
      }
    }
  });

  it('has all required variable fields', () => {
    for (const example of TEMPLATE_EXAMPLES) {
      for (const v of example.variables) {
        expect(v.name).toBeTruthy();
        expect(v.label).toBeTruthy();
        expect(['text', 'number', 'date', 'boolean']).toContain(v.type);
      }
    }
  });

  it('template names are unique', () => {
    const names = TEMPLATE_EXAMPLES.map(e => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
