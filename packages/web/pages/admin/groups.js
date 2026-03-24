import React from 'react';
import { SectionCard } from '../../components/WebBits.js';
import { loadAdminServerPage } from '../../lib/adminPageLoader.js';
import { loadAdminGroupsPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

const h = React.createElement;

export default function AdminGroupsPage() {
  return h(
    SectionCard,
    {
      eyebrow: 'Admin Groups',
      title: 'Group management retired',
      copy: 'Workspace visibility is no longer grouped by custom audience definitions. Use the project visibility toggle to decide whether a project is public or sign-in only.',
    },
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => (
  loadAdminServerPage({
    context,
    store,
    loader: loadAdminGroupsPage,
    dispatchers: {
      setViewMode,
      setRuntimeConfig,
      setSelectedProjectSlug,
      setSelectedRunId,
    },
  })
));
