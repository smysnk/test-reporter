import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { executeBrowserGraphql } from '../lib/adminClient.js';
import { EmptyState, SectionCard } from './WebBits.js';

export function useAdminPageActions() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  async function runGraphqlAction({ query, variables = {}, reload = true, fetchImpl = fetch }) {
    if (pending) {
      return null;
    }

    setPending(true);
    setError('');

    try {
      const result = await executeBrowserGraphql({
        query,
        variables,
        fetchImpl,
      });

      if (reload) {
        await router.replace(router.asPath);
      }

      return result;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Request failed.');
      return null;
    } finally {
      setPending(false);
    }
  }

  return {
    pending,
    error,
    setError,
    runGraphqlAction,
  };
}

export function AdminNotice({ error }) {
  if (!error) {
    return null;
  }

  return React.createElement(
    'div',
    { className: 'web-admin-notice web-admin-notice--error', role: 'alert' },
    error,
  );
}

export function AdminFormField({ label, hint = '', children }) {
  return React.createElement(
    'label',
    { className: 'web-admin-field' },
    React.createElement('span', { className: 'web-admin-field__label' }, label),
    hint ? React.createElement('span', { className: 'web-admin-field__hint' }, hint) : null,
    children,
  );
}

export function AdminInput(props) {
  return React.createElement('input', {
    ...props,
    className: `web-admin-input${props.className ? ` ${props.className}` : ''}`,
  });
}

export function AdminTextArea(props) {
  return React.createElement('textarea', {
    ...props,
    className: `web-admin-textarea${props.className ? ` ${props.className}` : ''}`,
  });
}

export function AdminSelect(props) {
  return React.createElement('select', {
    ...props,
    className: `web-admin-select${props.className ? ` ${props.className}` : ''}`,
  });
}

export function AdminShortcutGrid({ items }) {
  const entries = Array.isArray(items) ? items.filter(Boolean) : [];
  if (entries.length === 0) {
    return null;
  }

  return React.createElement(
    'div',
    { className: 'web-admin-shortcuts' },
    ...entries.map((item) => React.createElement(
      Link,
      {
        key: item.href,
        href: item.href,
        className: 'web-admin-shortcut',
      },
      React.createElement('strong', { className: 'web-admin-shortcut__title' }, item.title),
      React.createElement('span', { className: 'web-admin-shortcut__copy' }, item.copy),
    )),
  );
}

export function AdminVisibilityChip({ isPublic }) {
  return React.createElement(
    'span',
    {
      className: isPublic
        ? 'web-chip web-chip--admin-public'
        : 'web-chip web-chip--admin-private',
    },
    isPublic ? 'Public' : 'Private',
  );
}

export function AdminAssignmentChips({ items, emptyLabel }) {
  const entries = Array.isArray(items) ? items.filter(Boolean) : [];
  if (entries.length === 0) {
    return React.createElement('span', { className: 'web-chip web-chip--muted' }, emptyLabel);
  }

  return React.createElement(
    'div',
    { className: 'web-inline-list' },
    ...entries.map((item) => React.createElement(
      'span',
      { className: 'web-chip', key: item },
      item,
    )),
  );
}

export function AdminAssignmentManager({
  title,
  copy,
  assignedItems,
  availableOptions,
  addLabel,
  emptyTitle,
  emptyCopy,
  pending,
  onAdd,
  onRemove,
}) {
  const [selectedId, setSelectedId] = React.useState('');
  const assigned = Array.isArray(assignedItems) ? assignedItems.filter(Boolean) : [];
  const options = Array.isArray(availableOptions) ? availableOptions.filter(Boolean) : [];

  return React.createElement(
    SectionCard,
    {
      eyebrow: 'Assignments',
      title,
      copy,
      compact: true,
    },
    assigned.length > 0
      ? React.createElement(
        'div',
        { className: 'web-list' },
        ...assigned.map((item) => React.createElement(
          'article',
          { className: 'web-list__item', key: item.id || item.key },
          React.createElement(
            'div',
            { className: 'web-list__row' },
            React.createElement(
              'div',
              { className: 'web-stack web-stack--tight' },
              React.createElement('strong', { className: 'web-list__title' }, item.name || item.key),
              item.description ? React.createElement('span', { className: 'web-list__meta' }, item.description) : null,
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'web-button web-button--ghost',
                disabled: pending,
                onClick: () => onRemove(item),
              },
              'Remove',
            ),
          ),
        )),
      )
      : React.createElement(EmptyState, {
        title: emptyTitle,
        copy: emptyCopy,
      }),
    options.length > 0
      ? React.createElement(
        'form',
        {
          className: 'web-admin-inline-form',
          onSubmit: (event) => {
            event.preventDefault();
            if (!selectedId) {
              return;
            }
            const option = options.find((entry) => entry.id === selectedId);
            if (option) {
              onAdd(option);
              setSelectedId('');
            }
          },
        },
        React.createElement(
          AdminFormField,
          { label: addLabel },
          React.createElement(
            AdminSelect,
            {
              value: selectedId,
              disabled: pending,
              onChange: (event) => setSelectedId(event.target.value),
            },
            React.createElement('option', { value: '' }, `Select ${addLabel.toLowerCase()}`),
            ...options.map((option) => React.createElement(
              'option',
              { key: option.id, value: option.id },
              `${option.key} — ${option.name}`,
            )),
          ),
        ),
        React.createElement(
          'button',
          {
            type: 'submit',
            className: 'web-button',
            disabled: pending || !selectedId,
          },
          'Add',
        ),
      )
      : React.createElement('p', { className: 'web-card__copy web-admin-help' }, `No additional ${addLabel.toLowerCase()} available.`),
  );
}

export function AdminCatalogEditor({
  eyebrow,
  title,
  copy,
  itemLabel,
  emptyTitle,
  emptyCopy,
  items,
  pending,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [createKey, setCreateKey] = React.useState('');
  const [createName, setCreateName] = React.useState('');
  const [createDescription, setCreateDescription] = React.useState('');
  const entries = Array.isArray(items) ? items.filter(Boolean) : [];

  return React.createElement(
    SectionCard,
    {
      eyebrow,
      title,
      copy,
    },
    React.createElement(
      'form',
      {
        className: 'web-admin-form',
        onSubmit: (event) => {
          event.preventDefault();
          onCreate({
            key: createKey,
            name: createName,
            description: createDescription,
          });
          setCreateKey('');
          setCreateName('');
          setCreateDescription('');
        },
      },
      React.createElement(
        'div',
        { className: 'web-admin-form__grid' },
        React.createElement(
          AdminFormField,
          { label: `${itemLabel} key` },
          React.createElement(AdminInput, {
            value: createKey,
            disabled: pending,
            onChange: (event) => setCreateKey(event.target.value),
            required: true,
            placeholder: `${itemLabel.toLowerCase()}-key`,
          }),
        ),
        React.createElement(
          AdminFormField,
          { label: `${itemLabel} name` },
          React.createElement(AdminInput, {
            value: createName,
            disabled: pending,
            onChange: (event) => setCreateName(event.target.value),
            required: true,
            placeholder: `${itemLabel} name`,
          }),
        ),
      ),
      React.createElement(
        AdminFormField,
        { label: 'Description', hint: 'Optional; helps admins understand intent.' },
        React.createElement(AdminTextArea, {
          rows: 3,
          value: createDescription,
          disabled: pending,
          onChange: (event) => setCreateDescription(event.target.value),
          placeholder: `${itemLabel} description`,
        }),
      ),
      React.createElement(
        'button',
        {
          type: 'submit',
          className: 'web-button',
          disabled: pending || !createKey.trim() || !createName.trim(),
        },
        `Create ${itemLabel}`,
      ),
    ),
    entries.length > 0
      ? React.createElement(
        'div',
        { className: 'web-list' },
        ...entries.map((entry) => React.createElement(CatalogListItem, {
          key: entry.id,
          entry,
          itemLabel,
          pending,
          onUpdate,
          onDelete,
        })),
      )
      : React.createElement(EmptyState, {
        title: emptyTitle,
        copy: emptyCopy,
      }),
  );
}

function CatalogListItem({ entry, itemLabel, pending, onUpdate, onDelete }) {
  const [keyValue, setKeyValue] = React.useState(entry.key || '');
  const [nameValue, setNameValue] = React.useState(entry.name || '');
  const [descriptionValue, setDescriptionValue] = React.useState(entry.description || '');

  React.useEffect(() => {
    setKeyValue(entry.key || '');
    setNameValue(entry.name || '');
    setDescriptionValue(entry.description || '');
  }, [entry.id, entry.key, entry.name, entry.description]);

  return React.createElement(
    'article',
    { className: 'web-list__item' },
    React.createElement(
      'div',
      { className: 'web-list__row' },
      React.createElement('strong', { className: 'web-list__title' }, entry.name || entry.key),
      React.createElement(
        'div',
        { className: 'web-inline-list' },
        React.createElement('span', { className: 'web-chip' }, `${entry.userCount} users`),
        React.createElement('span', { className: 'web-chip' }, `${entry.projectCount} projects`),
      ),
    ),
    React.createElement(
      'form',
      {
        className: 'web-admin-form',
        onSubmit: (event) => {
          event.preventDefault();
          onUpdate(entry.id, {
            key: keyValue,
            name: nameValue,
            description: descriptionValue,
          });
        },
      },
      React.createElement(
        'div',
        { className: 'web-admin-form__grid' },
        React.createElement(
          AdminFormField,
          { label: `${itemLabel} key` },
          React.createElement(AdminInput, {
            value: keyValue,
            disabled: pending,
            onChange: (event) => setKeyValue(event.target.value),
            required: true,
          }),
        ),
        React.createElement(
          AdminFormField,
          { label: `${itemLabel} name` },
          React.createElement(AdminInput, {
            value: nameValue,
            disabled: pending,
            onChange: (event) => setNameValue(event.target.value),
            required: true,
          }),
        ),
      ),
      React.createElement(
        AdminFormField,
        { label: 'Description' },
        React.createElement(AdminTextArea, {
          rows: 3,
          value: descriptionValue,
          disabled: pending,
          onChange: (event) => setDescriptionValue(event.target.value),
        }),
      ),
      React.createElement(
        'div',
        { className: 'web-admin-actions' },
        React.createElement(
          'button',
          {
            type: 'submit',
            className: 'web-button',
            disabled: pending || !keyValue.trim() || !nameValue.trim(),
          },
          'Save',
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'web-button web-button--ghost',
            disabled: pending,
            onClick: () => onDelete(entry.id),
          },
          `Delete ${itemLabel}`,
        ),
      ),
    ),
  );
}
