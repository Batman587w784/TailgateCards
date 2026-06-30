import { loadPRDs } from '../_lib/server/prd-loader';
import { McpServerTabs } from './mcp-server-tabs';
import { PRDManagerClient } from './prd-manager-client';

export async function McpServerInterface() {
  const initialPrds = await loadPRDs();

  return (
    <McpServerTabs
      prdManagerContent={<PRDManagerClient initialPrds={initialPrds} />}
    />
  );
}
