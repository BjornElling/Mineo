#!/usr/bin/env node
/**
 * Starter Playwright CLI fra agentværktøjernes eget node_modules.
 *
 * Værktøjet ligger bevidst uden for projektets afhængighedsgraf, fordi det pinner en anden
 * Playwright-runtime end `@playwright/test`. Derfor virker hverken `npx playwright-cli` eller
 * `node_modules/.bin` fra repo-roden — brug denne launcher:
 *
 *   node .agents/tools/playwright-cli.mjs --version
 */
import { launchAgentTool } from './launch.mjs';

await launchAgentTool('@playwright/cli', 'playwright-cli');
