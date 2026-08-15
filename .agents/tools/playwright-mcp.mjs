#!/usr/bin/env node
/**
 * Starter Playwright MCP-serveren fra agentværktøjernes eget node_modules.
 *
 * Kaldes af `.codex/config.toml`. Se `playwright-cli.mjs` for hvorfor værktøjet ikke ligger i
 * projektets egen afhængighedsgraf.
 */
import { launchAgentTool } from './launch.mjs';

await launchAgentTool('@playwright/mcp', 'playwright-mcp');
