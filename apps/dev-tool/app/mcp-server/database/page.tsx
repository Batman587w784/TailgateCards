import { Metadata } from 'next';

import { DatabaseToolsInterface } from './_components/database-tools-interface';
import { loadDatabaseToolsData } from './_lib/server/database-tools.loader';

interface DatabasePageProps {
  searchParams: {
    search?: string;
  };
}

export const metadata: Metadata = {
  title: 'Database Tools - MCP Server',
  description:
    'Explore database schemas, tables, functions, and enums through the MCP Server interface',
};

async function DatabasePage({ searchParams }: DatabasePageProps) {
  const searchTerm = searchParams.search || '';

  // Load all database data server-side
  const databaseData = await loadDatabaseToolsData();

  return (
    <DatabaseToolsInterface
      searchTerm={searchTerm}
      databaseData={databaseData}
    />
  );
}

export default DatabasePage;
