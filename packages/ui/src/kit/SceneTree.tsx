import type { CSSProperties, ReactElement } from 'react';
import { badge, iconButton, panel, row } from './styles';

export interface TreeNode {
  id: string;
  name: string;
  kind: string;
  visible?: boolean;
  children?: readonly TreeNode[];
}

export interface SceneTreeProps {
  nodes: readonly TreeNode[];
  selected: string | null;
  onSelect: (id: string) => void;
  onToggleVisible?: (id: string) => void;
  onDelete?: (id: string) => void;
  filter?: string;
}

const list: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };

const nameButton: CSSProperties = {
  flex: 1,
  minHeight: 32,
  padding: '4px 6px',
  font: 'inherit',
  fontSize: 13,
  textAlign: 'left',
  color: 'var(--hm-text, #dde6ee)',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 6,
  cursor: 'pointer',
  overflowWrap: 'anywhere',
};

export function filterTree(nodes: readonly TreeNode[], text: string): TreeNode[] {
  const needle = text.trim().toLowerCase();
  if (needle === '') return nodes as TreeNode[];
  const walk = (list: readonly TreeNode[]): TreeNode[] => {
    const kept: TreeNode[] = [];
    for (const node of list) {
      const kids = node.children ? walk(node.children) : [];
      const hit = node.name.toLowerCase().includes(needle);
      if (!hit && kids.length === 0) continue;
      const next: TreeNode = { ...node };
      if (node.children) next.children = kids;
      kept.push(next);
    }
    return kept;
  };
  return walk(nodes);
}

interface RowsProps {
  nodes: readonly TreeNode[];
  role: 'tree' | 'group';
  selected: string | null;
  onSelect: (id: string) => void;
  onToggleVisible?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function Rows(props: RowsProps): ReactElement {
  return (
    <ul role={props.role} style={list}>
      {props.nodes.map((node) => {
        const selected = node.id === props.selected;
        const toggle = props.onToggleVisible;
        const remove = props.onDelete;
        const shown = node.visible !== false;
        return (
          <li
            key={node.id}
            role="treeitem"
            data-id={node.id}
            aria-selected={selected}
            style={{ margin: '2px 0' }}
          >
            <div style={row}>
              <button
                type="button"
                title={node.name}
                onClick={() => props.onSelect(node.id)}
                style={{
                  ...nameButton,
                  ...(selected ? { background: 'var(--hm-line, #26303b)' } : null),
                }}
              >
                {node.name}
              </button>
              <span data-kind={node.kind} style={badge}>
                {node.kind}
              </span>
              {toggle ? (
                <button
                  type="button"
                  data-action="toggle"
                  aria-pressed={shown}
                  title={shown ? 'Hide' : 'Show'}
                  onClick={() => toggle(node.id)}
                  style={iconButton}
                >
                  {shown ? '◉' : '◌'}
                </button>
              ) : null}
              {remove ? (
                <button
                  type="button"
                  data-action="delete"
                  title="Delete"
                  onClick={() => remove(node.id)}
                  style={iconButton}
                >
                  ✕
                </button>
              ) : null}
            </div>
            {node.children && node.children.length > 0 ? (
              <div style={{ paddingLeft: 14 }}>
                <Rows
                  nodes={node.children}
                  role="group"
                  selected={props.selected}
                  onSelect={props.onSelect}
                  onToggleVisible={props.onToggleVisible}
                  onDelete={props.onDelete}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function SceneTree(props: SceneTreeProps): ReactElement {
  const nodes = filterTree(props.nodes, props.filter ?? '');
  return (
    <div data-kit="scene-tree" style={panel}>
      <Rows
        nodes={nodes}
        role="tree"
        selected={props.selected}
        onSelect={props.onSelect}
        onToggleVisible={props.onToggleVisible}
        onDelete={props.onDelete}
      />
    </div>
  );
}
