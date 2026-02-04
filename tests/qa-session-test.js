const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://liveroleplay.vercel.app';
const ACCESS_CODE = 'ADMIN001';
const SCREENSHOTS_DIR = path.join(__dirname, 'qa-screenshots');

// Criar diretório de screenshots
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const screenshot = async (page, name) => {
  const filepath = path.join(SCREENSHOTS_DIR, `${name}-${timestamp()}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot: ${name}`);
  return filepath;
};

const report = {
  startTime: new Date().toISOString(),
  steps: [],
  errors: [],
  screenshots: []
};

const logStep = (step, status, details = '') => {
  const entry = { step, status, details, time: new Date().toISOString() };
  report.steps.push(entry);
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
  console.log(`${icon} ${step}: ${status} ${details}`);
};

async function runQATest() {
  console.log('\n🧪 TESTE DE QA - LIVE ROLEPLAY\n');
  console.log('=' .repeat(50));

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slower for visibility
  });

  const context = await browser.newContext({
    permissions: ['microphone', 'camera'],
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Capturar erros do console
  page.on('console', msg => {
    if (msg.type() === 'error') {
      report.errors.push({ type: 'console', message: msg.text(), time: new Date().toISOString() });
    }
  });

  page.on('pageerror', error => {
    report.errors.push({ type: 'pageerror', message: error.message, time: new Date().toISOString() });
  });

  try {
    // ========== ETAPA 1: LOGIN ==========
    console.log('\n📍 ETAPA 1: LOGIN\n');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    report.screenshots.push(await screenshot(page, '01-login-page'));
    logStep('Página de login carregada', 'PASS');

    // Inserir código de acesso
    const codeInput = await page.locator('input[type="text"], input[placeholder*="código"], input[placeholder*="code"]').first();
    if (await codeInput.isVisible()) {
      await codeInput.fill(ACCESS_CODE);
      logStep('Código de acesso inserido', 'PASS', ACCESS_CODE);
    } else {
      logStep('Campo de código não encontrado', 'FAIL');
    }

    report.screenshots.push(await screenshot(page, '02-code-entered'));

    // Clicar no botão de entrar
    const enterButton = await page.locator('button:has-text("Entrar"), button:has-text("Enter"), button[type="submit"]').first();
    if (await enterButton.isVisible()) {
      await enterButton.click();
      logStep('Botão de login clicado', 'PASS');
    }

    // Aguardar navegação para /home
    await page.waitForURL('**/home', { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    if (currentUrl.includes('/home')) {
      logStep('Redirecionamento para /home', 'PASS', currentUrl);
    } else {
      logStep('Redirecionamento para /home', 'FAIL', `URL atual: ${currentUrl}`);
    }

    report.screenshots.push(await screenshot(page, '03-home-page'));

    // ========== ETAPA 2: SELEÇÃO DE CENÁRIO ==========
    console.log('\n📍 ETAPA 2: SELEÇÃO DE CENÁRIO\n');

    // Verificar lista de cenários
    await page.waitForTimeout(2000);

    const scenarioCards = await page.locator('[class*="scenario"], [class*="card"], button:has-text("Proposta"), button:has-text("Objeção"), button:has-text("Negociação")').all();
    logStep('Cenários encontrados', scenarioCards.length > 0 ? 'PASS' : 'FAIL', `${scenarioCards.length} cenários`);

    report.screenshots.push(await screenshot(page, '04-scenarios-list'));

    // Clicar no primeiro cenário ou em "Apresentação de Proposta"
    const propostaScenario = await page.locator('button:has-text("Proposta"), [class*="card"]:has-text("Proposta"), div:has-text("Apresentação")').first();

    if (await propostaScenario.isVisible()) {
      await propostaScenario.click();
      logStep('Cenário selecionado', 'PASS', 'Apresentação de Proposta');
    } else {
      // Tentar clicar no primeiro card
      const firstCard = await page.locator('[class*="card"], [class*="scenario"]').first();
      if (await firstCard.isVisible()) {
        await firstCard.click();
        logStep('Primeiro cenário selecionado', 'PASS');
      } else {
        logStep('Nenhum cenário encontrado para clicar', 'FAIL');
      }
    }

    await page.waitForTimeout(1000);
    report.screenshots.push(await screenshot(page, '05-scenario-selected'));

    // ========== ETAPA 3: MODAL DE MODO ==========
    console.log('\n📍 ETAPA 3: SELEÇÃO DE MODO\n');

    // Verificar se modal de modo apareceu
    await page.waitForTimeout(1000);
    const modeModal = await page.locator('[class*="modal"], [role="dialog"], div:has-text("Selecione o modo"), div:has-text("Modo Treino")').first();

    if (await modeModal.isVisible()) {
      logStep('Modal de modo exibido', 'PASS');
      report.screenshots.push(await screenshot(page, '06-mode-modal'));

      // Verificar sistema de dificuldade
      const difficultyLevel = await page.locator('text=/NIVEL DE DIFICULDADE|Dificuldade/i').first();
      if (await difficultyLevel.isVisible()) {
        logStep('Sistema de dificuldade visível', 'PASS');
      }

      // Verificar intensidade do coach
      const coachIntensity = await page.locator('text=/Intensidade do Coach/i').first();
      if (await coachIntensity.isVisible()) {
        logStep('Intensidade do Coach visível', 'PASS');
      }

      // Clicar em "Iniciar Sessão"
      const startButton = await page.locator('button:has-text("Iniciar Sessao"), button:has-text("Iniciar Sessão"), button:has-text("Start Session")').first();
      if (await startButton.isVisible()) {
        await startButton.click();
        logStep('Botão "Iniciar Sessão" clicado', 'PASS');
      } else {
        logStep('Botão de iniciar não encontrado', 'FAIL');
      }
    } else {
      logStep('Modal de modo não encontrado', 'FAIL');
    }

    // ========== ETAPA 4: SESSÃO DE ROLEPLAY ==========
    console.log('\n📍 ETAPA 4: SESSÃO DE ROLEPLAY\n');

    // Aguardar navegação para /session
    await page.waitForURL('**/session/**', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle');

    const sessionUrl = page.url();
    if (sessionUrl.includes('/session/')) {
      logStep('Navegação para sessão', 'PASS', sessionUrl);
    } else {
      logStep('Navegação para sessão', 'FAIL', `URL: ${sessionUrl}`);
    }

    report.screenshots.push(await screenshot(page, '07-session-loading'));

    // Aguardar conexão WebRTC/LiveKit
    await page.waitForTimeout(5000);

    // Verificar elementos da sessão
    const videoElement = await page.locator('video, [class*="avatar"], [class*="video"]').first();
    if (await videoElement.isVisible()) {
      logStep('Elemento de vídeo/avatar encontrado', 'PASS');
    } else {
      logStep('Elemento de vídeo/avatar não encontrado', 'FAIL');
    }

    report.screenshots.push(await screenshot(page, '08-session-active'));

    // Verificar status de conexão
    const connectionStatus = await page.locator('[class*="status"], [class*="connection"], span:has-text("Conectado"), span:has-text("Connected")').first();
    if (await connectionStatus.isVisible()) {
      const statusText = await connectionStatus.textContent();
      logStep('Status de conexão', 'PASS', statusText);
    }

    // Aguardar um pouco para ver a sessão ativa
    console.log('\n⏳ Sessão ativa - aguardando 10 segundos para observação...\n');
    await page.waitForTimeout(10000);

    report.screenshots.push(await screenshot(page, '09-session-running'));

    // ========== ETAPA 5: FINALIZAÇÃO ==========
    console.log('\n📍 ETAPA 5: FINALIZAÇÃO\n');

    // Procurar botão de encerrar
    const endButton = await page.locator('button:has-text("Encerrar"), button:has-text("End"), button:has-text("Finalizar"), button[class*="end"]').first();

    if (await endButton.isVisible()) {
      await endButton.click();
      logStep('Sessão encerrada', 'PASS');
    } else {
      logStep('Botão de encerrar não encontrado', 'FAIL');
    }

    await page.waitForTimeout(3000);
    report.screenshots.push(await screenshot(page, '10-session-ended'));

    // Verificar redirecionamento para feedback
    await page.waitForURL('**/feedback/**', { timeout: 10000 }).catch(() => {});

    const feedbackUrl = page.url();
    if (feedbackUrl.includes('/feedback/')) {
      logStep('Redirecionamento para feedback', 'PASS', feedbackUrl);

      // Aguardar carregamento do feedback
      await page.waitForTimeout(5000);
      report.screenshots.push(await screenshot(page, '11-feedback-page'));

      // Verificar elementos de feedback
      const scoreElement = await page.locator('[class*="score"], [class*="rating"], span:has-text("Score"), span:has-text("Pontuação")').first();
      if (await scoreElement.isVisible()) {
        const scoreText = await scoreElement.textContent();
        logStep('Score exibido', 'PASS', scoreText);
      }
    } else {
      logStep('Redirecionamento para feedback', 'FAIL', `URL: ${feedbackUrl}`);
    }

    report.screenshots.push(await screenshot(page, '12-final-state'));

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    report.errors.push({ type: 'test-error', message: error.message, stack: error.stack });
    await screenshot(page, 'error-state');
  } finally {
    // Gerar relatório
    report.endTime = new Date().toISOString();

    const passCount = report.steps.filter(s => s.status === 'PASS').length;
    const failCount = report.steps.filter(s => s.status === 'FAIL').length;

    console.log('\n' + '='.repeat(50));
    console.log('📊 RELATÓRIO DE QA');
    console.log('='.repeat(50));
    console.log(`✅ Passou: ${passCount}`);
    console.log(`❌ Falhou: ${failCount}`);
    console.log(`📸 Screenshots: ${report.screenshots.length}`);
    console.log(`⚠️ Erros capturados: ${report.errors.length}`);
    console.log('='.repeat(50));

    // Salvar relatório JSON
    const reportPath = path.join(SCREENSHOTS_DIR, `qa-report-${timestamp()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Relatório salvo: ${reportPath}\n`);

    // Manter browser aberto por 5 segundos para visualização
    console.log('🔍 Mantendo browser aberto para visualização...');
    await page.waitForTimeout(5000);

    await browser.close();
  }
}

// Executar teste
runQATest().catch(console.error);
