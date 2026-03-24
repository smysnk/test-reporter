import React from 'react';
import { SectionCard } from '../../components/WebBits.js';
import { loadAdminServerPage } from '../../lib/adminPageLoader.js';
import { loadAdminRolesPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

const h = React.createElement;

export default function AdminRolesPage() {
  return h(
    SectionCard,
    {
      eyebrow: 'Admin Roles',
      title: 'Role management retired',
      copy: 'Workspace visibility now uses a simpler model. Guests can see public projects, signed-in users can see private projects, and admins manage visibility directly on each project.',
    },
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => (
  loadAdminServerPage({
    context,
    store,
    loader: loadAdminRolesPage,
    dispatchers: {
      setViewMode,
      setRuntimeConfig,
      setSelectedProjectSlug,
      setSelectedRunId,
    },
  })
));
