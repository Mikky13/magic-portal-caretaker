// ── Destination Worlds Database ─────────────────────────────
const DESTINATIONS = [
    "Инферно Прайм", "Морозная Лощина", "Void Reach", "Изумрудный Дрейф", 
    "Кристальный Нексус", "Теневое Царство", "Цитадель Эфира", "Квантовый Мир", 
    "Ядро Хроноса", "Обсидиановый Разлом", "Светоносный Простор", "Титан Луна", 
    "Солярный Нексус", "Астральный Пик", "Тёмный Океан", "Пандора-7", 
    "Кибер-Веретено", "Туманность Орион", "Древний Мальстрим", "Олимп Марса", 
    "Бездна Хаоса", "Звёздная Гавань", "Сумеречный Арканум", "Спектральный Вал"
];

// ── Random Name Generator Helpers ───────────────────────────
const NAME_PREFIXES = ["Древний", "Мистический", "Квантовый", "Тёмный", "Астральный", "Гравитационный", "Плазменный", "Эфирный", "Импульсный", "Штормовой", "Призрачный", "Гиперборейский"];
const NAME_TYPES = ["Разлом", "Врата", "Портал", "Порог", "Вортекс", "Арка", "Аномалия", "Сдвиг", "Спираль", "Коридор"];
const NAME_DESIGNATIONS = ["Альфа-1", "Бета-9", "Гамма-4", "Дельта-7", "Эпсилон-2", "Дзета-8", "Эта-3", "Тета-6", "Йота-5", "Каппа-12", "Сигма-10", "Омега-X"];

function generateRandomPortalName(id) {
    const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
    const type = NAME_TYPES[Math.floor(Math.random() * NAME_TYPES.length)];
    const desig = NAME_DESIGNATIONS[Math.floor(Math.random() * NAME_DESIGNATIONS.length)];
    return `${prefix} ${type} ${desig}`;
}

function createRandomPortal(id) {
    const dest = DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)];
    const statuses = ["open", "open", "open", "stabilizing", "under_review"];
    const status = id === 6 ? "closed" : statuses[Math.floor(Math.random() * statuses.length)];

    return {
        id: id,
        name: generateRandomPortalName(id),
        destination_world: dest,
        energy_level: Math.floor(Math.random() * 85) + 10,
        stability: status === "closed" ? 80 : Math.floor(Math.random() * 75) + 10,
        time_to_collapse_sec: status === "closed" ? 120 : Math.floor(Math.random() * 90) + 10,
        entity_count: status === "closed" ? 0 : Math.floor(Math.random() * 6),
        status: status,
        history: [{
            timestamp: getTimestamp(),
            action: "Инициализация",
            note: `Обнаружен межпространственный разлом в мир «${dest}».`
        }]
    };
}

function generateInitialPortals() {
    const initialList = [];
    for (let i = 1; i <= 6; i++) {
        initialList.push(createRandomPortal(i));
    }
    return initialList;
}

// ── Resource Constants ────────────────────────────────
const RESOURCE_MAX = 200;
const RESOURCE_REGEN_PER_TICK = 8;
const ACTION_COSTS = {
    stabilize: 15,
    close: 25,
    evacuate: 20,
    observer: 10,
    review: 5,
};
const UPGRADE_COSTS = {
    stability: 12,
    energy: 10,
    time: 12,
};

// ── Breach Penalty Constants ────────────────────────
const BREACH_BASE_PENALTY = 20;
const BREACH_ENTITY_PENALTY = 10;

// ── State Variables ────────────────────────────────
let portals = [];
let actionLog = [];
let autoTickEnabled = true;
let autoTickTimer = null;
let soundEnabled = true;
let activeModalPortalId = null;
let nextPortalId = 1;
let showClosed = false;
let resources = 100;

// ── Auto-Discovery Settings ────────────────────────
const MAX_ACTIVE_PORTALS = 8;
const DISCOVER_INTERVAL_MS = 15000;
const FIRST_DISCOVER_DELAY_MS = 5000;
let autoDiscoverTimer = null;

// ── Web Audio Synthesizer Effects ─────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (!soundEnabled) return;
    try {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        if (type === 'stabilize') {
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'close') {
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'evacuate') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'alarm') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.setValueAtTime(400, now + 0.1);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'click') {
            osc.frequency.setValueAtTime(600, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'breach') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        }
    } catch (e) {
        // Fallback
    }
}

// ── Helpers ──────────────────────────────────────
function getTimestamp() {
    const now = new Date();
    return now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0');
}

function calculateRisk(portal) {
    const energy = portal.energy_level;
    const stability = portal.stability;
    const collapse = portal.time_to_collapse_sec;
    const score = (energy * 1.5) + (100 - stability) + (300 / Math.max(collapse, 1));

    let level = 'НИЗКИЙ';
    if (score > 150) {
        level = 'КРИТИЧЕСКИЙ';
    } else if (score > 100) {
        level = 'ВЫСОКИЙ';
    } else if (score > 60) {
        level = 'СРЕДНИЙ';
    }
    return { level, score: parseFloat(score.toFixed(2)) };
}

// ── Dynamic Context-Aware Recommendations ────────────────
function getRecommendedAction(portal) {
    if (portal.status === 'closed') {
        return "🔒 Портал запечатан и безопасен.";
    }

    const recommendations = [];

    if (portal.time_to_collapse_sec <= 10) {
        recommendations.push(`⚠️ СРОЧНО: До схлопывания осталось ${portal.time_to_collapse_sec}с! Выполните стабилизацию.`);
    } else if (portal.time_to_collapse_sec <= 20) {
        recommendations.push(`⏳ Схлопывание близко (${portal.time_to_collapse_sec}с).`);
    }

    if (portal.stability <= 25) {
        recommendations.push(`🚨 Критическая стабильность (${portal.stability}%).`);
    } else if (portal.stability <= 50) {
        recommendations.push(`📉 Низкая стабильность (${portal.stability}%).`);
    }

    if (portal.energy_level >= 80) {
        recommendations.push(`⚡ Высокая энергия (${portal.energy_level}%).`);
    }

    if (portal.entity_count > 0) {
        recommendations.push(`👾 Внутри ${portal.entity_count} существ. Требуется эвакуация.`);
    }

    if (portal.status === 'under_review') {
        recommendations.push(`🔍 Находится под контролем. Направьте наблюдателя.`);
    } else if (portal.status === 'stabilizing') {
        recommendations.push(`🔄 Идёт стабилизация структуры.`);
    }

    if (recommendations.length === 0) {
        return "✅ Все показатели в норме. Можно отправить наблюдателя.";
    }

    return recommendations.join(" ");
}

function translateStatus(status) {
    switch (status) {
        case 'open': return 'открыт';
        case 'stabilizing': return 'стабилизируется';
        case 'closed': return 'закрыт';
        case 'under_review': return 'под вопросом';
        default: return status;
    }
}

function addLog(portalName, action, note) {
    actionLog.push({
        timestamp: getTimestamp(),
        portal_name: portalName,
        action: action,
        note: note
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    setTimeout(() => { toast.classList.add('hidden'); }, 3500);
    requestAnimationFrame(() => { toast.classList.remove('hidden'); });
}

function riskBadgeClass(level) {
    switch (level) {
        case 'КРИТИЧЕСКИЙ': return 'badge badge-critical';
        case 'ВЫСОКИЙ': return 'badge badge-high';
        case 'СРЕДНИЙ': return 'badge badge-medium';
        default: return 'badge badge-low';
    }
}

function statusBadgeClass(status) {
    return `status-badge status-${status}`;
}

function renderMeterBar(value, type) {
    const isEnergy = type === 'energy';
    const barClass = isEnergy
        ? (value > 75 ? 'meter-danger' : value > 50 ? 'meter-warning' : 'meter-normal')
        : (value < 30 ? 'meter-danger' : value < 60 ? 'meter-warning' : 'meter-normal');
    return `
    <div class="meter-wrapper">
        <span class="meter-text">${value}%</span>
        <div class="meter-bar-bg">
            <div class="meter-bar-fill ${barClass}" style="width:${Math.min(100, Math.max(0, value))}%"></div>
        </div>
    </div>`;
}

// ── Confirmation Dialog ───────────────────────────
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirm-overlay');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        overlay.classList.remove('hidden');

        const yesBtn = document.getElementById('confirm-yes');
        const noBtn = document.getElementById('confirm-no');

        const cleanup = (result) => {
            overlay.classList.add('hidden');
            yesBtn.onclick = null;
            noBtn.onclick = null;
            resolve(result);
        };

        yesBtn.onclick = () => cleanup(true);
        noBtn.onclick = () => cleanup(false);
    });
}

// ── Resource UI Update ───────────────────────────
function updateResourceUI() {
    const valueEl = document.getElementById('resource-value');
    const maxEl = document.getElementById('resource-max');
    const fillEl = document.getElementById('resource-bar-fill');
    const displayEl = document.getElementById('resources-display');

    if (!valueEl) return;

    valueEl.textContent = resources;
    if (maxEl) maxEl.textContent = '/ ' + RESOURCE_MAX;

    const pct = (resources / RESOURCE_MAX) * 100;
    if (fillEl) {
        fillEl.style.width = pct + '%';
        if (resources < 20) {
            fillEl.style.background = 'linear-gradient(90deg, #ff6b6b, #e55050)';
        } else if (resources < 50) {
            fillEl.style.background = 'linear-gradient(90deg, #ffa502, #e69500)';
        } else {
            fillEl.style.background = 'linear-gradient(90deg, #2ed573, #26b35e)';
        }
    }

    if (displayEl) {
        if (resources < 20) {
            displayEl.classList.add('low');
        } else {
            displayEl.classList.remove('low');
        }
    }

    document.querySelectorAll('[data-action][data-cost]').forEach(btn => {
        const cost = parseInt(btn.dataset.cost, 10);
        btn.disabled = resources < cost;
    });

    document.querySelectorAll('[data-upgrade][data-cost]').forEach(btn => {
        const cost = parseInt(btn.dataset.cost, 10);
        btn.disabled = resources < cost;
    });
}

// ── Rendering Functions ───────────────────────────
function renderDashboard() {
    const decoratedPortals = portals.map(p => {
        const risk = calculateRisk(p);
        return { ...p, risk_level: risk.level, risk_score: risk.score };
    });

    const open = decoratedPortals.filter(p => p.status === 'open' || p.status === 'stabilizing' || p.status === 'under_review').length;
    const critical = decoratedPortals.filter(p => p.risk_level === 'КРИТИЧЕСКИЙ').length;
    const closed = decoratedPortals.filter(p => p.status === 'closed').length;
    const urgent = decoratedPortals.filter(p => p.risk_level === 'КРИТИЧЕСКИЙ' || p.risk_level === 'ВЫСОКИЙ').length;

    document.querySelector('#stat-open .stat-number').textContent = open;
    document.querySelector('#stat-critical .stat-number').textContent = critical;
    document.querySelector('#stat-closed .stat-number').textContent = closed;
    document.querySelector('#stat-urgent .stat-number').textContent = urgent;
}

function renderPortals() {
    const container = document.getElementById('portals-table');
    const activePortals = portals.filter(p => p.status !== 'closed');

    if (activePortals.length === 0) {
        container.innerHTML = '<p style="color:#636e72;padding:20px;">Ожидание обнаружения разломов... Новые порталы появятся автоматически.</p>';
        renderDashboard();
        updateResourceUI();
        return;
    }

    let html = `
    <table>
        <thead>
            <tr>
                <th>Название</th>
                <th>Мир назначения</th>
                <th>Энергия</th>
                <th>Стабильность</th>
                <th>Схлопывание</th>
                <th>Существа</th>
                <th>Статус</th>
                <th>Риск</th>
                <th>Оценка</th>
                <th>Действия Хранителя</th>
            </tr>
        </thead>
        <tbody>
    `;

    for (const p of activePortals) {
        const risk = calculateRisk(p);
        const rowClass = risk.level === 'КРИТИЧЕСКИЙ' ? 'row-critical' : '';
        const isClosed = p.status === 'closed';

        html += `
        <tr class="${rowClass}">
            <td><span class="portal-name" data-id="${p.id}" title="Кликните для открытия подробной карточки">${p.name}</span></td>
            <td>${p.destination_world}</td>
            <td>${renderMeterBar(p.energy_level, 'energy')}</td>
            <td>${renderMeterBar(p.stability, 'stability')}</td>
            <td><span class="${p.time_to_collapse_sec <= 10 ? 'urgent-timer' : ''}">${p.time_to_collapse_sec}с</span></td>
            <td>${p.entity_count}</td>
            <td><span class="${statusBadgeClass(p.status)}">${translateStatus(p.status)}</span></td>
            <td><span class="${riskBadgeClass(risk.level)}">${risk.level}</span></td>
            <td>${risk.score}</td>
            <td>
                <div class="actions">
                    <button class="btn btn-stabilize btn-sm" data-action="stabilize" data-id="${p.id}" data-cost="${ACTION_COSTS.stabilize}" title="Повысить стабильность и снизить энергию (${ACTION_COSTS.stabilize} ресурсов)" ${isClosed ? 'disabled title="Нельзя стабилизировать закрытый портал"' : ''}>&#128737; Стабилизировать</button>
                    ${p.entity_count > 0 ? `<button class="btn btn-evacuate btn-sm" data-action="evacuate" data-id="${p.id}" data-cost="${ACTION_COSTS.evacuate}" title="Безопасно вывести существ из портала (${ACTION_COSTS.evacuate} ресурсов)" ${isClosed ? 'disabled' : ''}>&#128680; Эвакуировать (${p.entity_count})</button>` : ''}
                    <button class="btn btn-close btn-sm" data-action="close" data-id="${p.id}" data-cost="${ACTION_COSTS.close}" title="Безопасно запечатать портал (${ACTION_COSTS.close} ресурсов)" ${isClosed ? 'disabled title="Портал уже закрыт"' : ''}>&#128274; Закрыть</button>
                    <button class="btn btn-observer btn-sm" data-action="observer" data-id="${p.id}" data-cost="${ACTION_COSTS.observer}" title="Отправить развед-дрона (${ACTION_COSTS.observer} ресурсов)" ${risk.level === 'КРИТИЧЕСКИЙ' || isClosed ? 'disabled title="Заблокировано для критических/закрытых порталов"' : ''}>&#128065; Наблюдатель</button>
                    <button class="btn btn-review btn-sm" data-action="review" data-id="${p.id}" data-cost="${ACTION_COSTS.review}" title="Пометить портал для проверки (${ACTION_COSTS.review} ресурсов)">? Под вопросом</button>
                </div>
            </td>
        </tr>
        `;
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
    renderDashboard();
    updateResourceUI();
}

// ── Closed Portals Rendering ──────────────────────
function renderClosedPortals() {
    const container = document.getElementById('closed-table');
    const closedPortals = portals.filter(p => p.status === 'closed');

    if (closedPortals.length === 0) {
        container.innerHTML = '<p style="color:#636e72;padding:20px; text-align:center;">Пока нет запечатанных порталов.</p>';
        return;
    }

    let html = `
    <table>
        <thead>
            <tr>
                <th>Название</th>
                <th>Мир назначения</th>
                <th>Энергия</th>
                <th>Стабильность</th>
                <th>Существа (погибли)</th>
                <th>Причина закрытия</th>
                <th>Время закрытия</th>
            </tr>
        </thead>
        <tbody>
    `;

    for (const p of closedPortals) {
        let cause = 'Ручное закрытие';
        let creaturesDied = 0;
        let closeTime = '—';
        let resourceLoss = 0;

        for (let i = p.history.length - 1; i >= 0; i--) {
            const h = p.history[i];
            if (h.action === 'BREACH ALERT') {
                cause = '💥 БРЕЧ (схлопнулся)';
                const match = h.note.match(/(\d+)\s+существ/);
                if (match) creaturesDied = parseInt(match[1]);
                const lossMatch = h.note.match(/Потеряно\s+(\d+)\s+ресурсов/);
                if (lossMatch) resourceLoss = parseInt(lossMatch[1]);
                break;
            }
            if (h.action === 'Force Close') {
                cause = 'Принудительное закрытие';
                const match = h.note.match(/(\d+)\s+существ/);
                if (match) creaturesDied = parseInt(match[1]);
                closeTime = h.timestamp;
                break;
            }
            if (h.action === 'Закрытие') {
                cause = 'Безопасное закрытие';
                closeTime = h.timestamp;
                break;
            }
        }

        html += `
        <tr>
            <td><span class="portal-name" data-id="${p.id}" title="Кликните для открытия подробной карточки">${p.name}</span></td>
            <td>${p.destination_world}</td>
            <td>${p.energy_level}%</td>
            <td>${p.stability}%</td>
            <td>${creaturesDied > 0 ? '<span style="color:#ff6b6b; font-weight:700;">' + creaturesDied + '</span>' : '0'}</td>
            <td><span class="badge badge-critical">${cause}</span></td>
            <td style="font-size:0.78rem; color:#6b7c93;">${closeTime}</td>
            <td style="font-size:0.78rem; color:#ff6b6b; font-weight:600;">${resourceLoss > 0 ? '−' + resourceLoss + ' рес.' : '—'}</td>
        </tr>
        `;
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ── Action Log Rendering ──────────────────────────
function renderActionLog() {
    const container = document.getElementById('action-log');
    if (actionLog.length === 0) {
        container.innerHTML = '<div class="log-empty">Нет записей в журнале.</div>';
        return;
    }

    let html = '';
    for (const entry of actionLog) {
        const isBreach = entry.action === 'BREACH ALERT';
        html += `
        <div class="log-entry ${isBreach ? 'log-breach' : ''}">
            <span class="log-time">${entry.timestamp}</span>
            <span class="log-portal">${entry.portal_name}</span>
            <span class="log-action">${entry.action}</span>
            <span class="log-note">${entry.note}</span>
        </div>
        `;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ── Portal Detail Modal ───────────────────────────
function openPortalDetail(portalId) {
    const p = portals.find(x => x.id === portalId);
    if (!p) return;

    activeModalPortalId = portalId;
    const risk = calculateRisk(p);

    document.getElementById('modal-title').textContent = p.name;

    const bodyHtml = `
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">Мир назначения</div>
                <div class="detail-value">${p.destination_world}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Статус</div>
                <div class="detail-value"><span class="${statusBadgeClass(p.status)}">${translateStatus(p.status)}</span></div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Энергия</div>
                <div class="detail-value">${p.energy_level}%</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Стабильность</div>
                <div class="detail-value">${p.stability}%</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Схлопывание</div>
                <div class="detail-value">${p.time_to_collapse_sec}с</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Существа</div>
                <div class="detail-value">${p.entity_count}</div>
            </div>
        </div>

        <div class="risk-breakdown">
            <h3>Оценка риска: <span class="${riskBadgeClass(risk.level)}" style="margin-left:8px;">${risk.level}</span></h3>
            <div class="breakdown-row">
                <span class="label">Энергия × 1.5</span>
                <span class="value">${(p.energy_level * 1.5).toFixed(2)}</span>
            </div>
            <div class="breakdown-row">
                <span class="label">100 − Стабильность</span>
                <span class="value">${(100 - p.stability).toFixed(2)}</span>
            </div>
            <div class="breakdown-row">
                <span class="label">300 ÷ max(Схлопывание, 1)</span>
                <span class="value">${(300 / Math.max(p.time_to_collapse_sec, 1)).toFixed(2)}</span>
            </div>
            <div class="breakdown-total">
                <span>Итого</span>
                <span>${risk.score}</span>
            </div>
        </div>

        <div class="recommended-action">
            <strong>Рекомендация:</strong><br>
            ${getRecommendedAction(p)}
        </div>

        <div class="upgrade-section">
            <h3>🔧 Обслуживание портала</h3>
            <button class="btn btn-upgrade btn-sm upgrade-btn" data-upgrade="stability" data-id="${p.id}" data-cost="${UPGRADE_COSTS.stability}" title="Укрепить стабильность +15% (${UPGRADE_COSTS.stability} ресурсов)">🛡 Укрепить стабильность +15%</button>
            <button class="btn btn-upgrade btn-sm upgrade-btn" data-upgrade="energy" data-id="${p.id}" data-cost="${UPGRADE_COSTS.energy}" title="Снизить энергию -10% (${UPGRADE_COSTS.energy} ресурсов)">⚡ Снизить энергию -10%</button>
            <button class="btn btn-upgrade btn-sm upgrade-btn" data-upgrade="time" data-id="${p.id}" data-cost="${UPGRADE_COSTS.time}" title="Добавить время +15с (${UPGRADE_COSTS.time} ресурсов)">⏰ Добавить время +15с</button>
        </div>

        <h3 style="font-size:0.95rem; margin-bottom:8px;">История</h3>
        <ul class="history-list">
            ${p.history.map(h => `
                <li>
                    <span class="history-time">${h.timestamp}</span>
                    <span class="history-action">${h.action}</span>
                    <span class="history-note">— ${h.note}</span>
                </li>
            `).join('')}
        </ul>
    `;

    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

// ── Local Simulation Tick ───────────────────────
async function tickSimulation() {
    // Regenerate resources each tick
    resources = Math.min(RESOURCE_MAX, resources + RESOURCE_REGEN_PER_TICK);

    const events = [];

    for (const p of portals) {
        if (p.status === 'closed') continue;

        p.time_to_collapse_sec = Math.max(0, p.time_to_collapse_sec - 2);

        const energyDelta = Math.floor(Math.random() * 5) - 2;
        p.energy_level = Math.max(0, Math.min(100, p.energy_level + energyDelta));

        if (p.stability < 40 && Math.random() < 0.3) {
            p.stability = Math.max(0, p.stability - 2);
        }

        if (p.time_to_collapse_sec <= 0) {
            const entityCount = p.entity_count;
            p.status = 'closed';
            p.time_to_collapse_sec = 0;

            // Calculate resource penalty for breach
            const resourcePenalty = BREACH_BASE_PENALTY + (entityCount * BREACH_ENTITY_PENALTY);
            const actualLoss = Math.min(resources, resourcePenalty);
            resources -= actualLoss;

            let breachNote;
            if (entityCount > 0) {
                breachNote = `💥 БРЕЧ! Портал «${p.name}» схлопнулся! ${entityCount} существ(а) погибли внутри! Потеряно ${actualLoss} ресурсов.`;
            } else {
                breachNote = `💥 БРЕЧ! Портал «${p.name}» схлопнулся! Портал пуст — жертв нет. Потеряно ${actualLoss} ресурсов.`;
            }
            p.history.push({
                timestamp: getTimestamp(),
                action: "BREACH ALERT",
                note: breachNote
            });
            events.push(breachNote);
            addLog(p.name, "BREACH ALERT", breachNote);
            playSound('breach');
            continue;
        }

        if (p.status === 'stabilizing' && p.stability >= 70) {
            p.status = 'open';
            p.history.push({
                timestamp: getTimestamp(),
                action: "Стабилизация завершена",
                note: `Портал «${p.name}» вернулся к нормальному состоянию. Стабильность: ${p.stability}%.`
            });
        }

        if (p.time_to_collapse_sec <= 10 && p.time_to_collapse_sec > 0 && p.status !== 'stabilizing') {
            events.push(`⚠️ Портал «${p.name}» схлопнется через ${p.time_to_collapse_sec}с!`);
        }
    }

    renderPortals();
    renderActionLog();
    updateClosedButton();
}

// ── Auto-Discovery of New Portals ─────────────────
function discoverNewPortal() {
    const activeCount = portals.filter(p => p.status !== 'closed').length;
    if (activeCount >= MAX_ACTIVE_PORTALS) {
        return;
    }

    const newPortal = createRandomPortal(nextPortalId);
    nextPortalId++;
    portals.push(newPortal);
    const note = `Автоматическое обнаружение: ${newPortal.name} → ${newPortal.destination_world}`;
    addLog(newPortal.name, "Обнаружение", note);
    showToast(`🔍 Новый разлом обнаружен: ${newPortal.name} → ${newPortal.destination_world}`, 'success');
    playSound('alarm');
    renderPortals();
    renderActionLog();
    updateClosedButton();
}

function startAutoDiscovery() {
    stopAutoDiscovery();

    autoDiscoverTimer = setTimeout(() => {
        discoverNewPortal();
        autoDiscoverTimer = setInterval(() => {
            discoverNewPortal();
        }, DISCOVER_INTERVAL_MS);
    }, FIRST_DISCOVER_DELAY_MS);
}

function stopAutoDiscovery() {
    if (autoDiscoverTimer) {
        clearTimeout(autoDiscoverTimer);
        autoDiscoverTimer = null;
    }
}

// ── Closed Portal Toggle ──────────────────────
function updateClosedButton() {
    const closedCount = portals.filter(p => p.status === 'closed').length;
    const btn = document.getElementById('btn-toggle-closed');
    if (btn) {
        btn.innerHTML = `&#128274; ${showClosed ? 'Скрыть запечатанные' : 'Показать запечатанные'} (${closedCount})`;
    }
}

function toggleClosedPortals() {
    showClosed = !showClosed;
    const section = document.getElementById('closed-section');
    const btn = document.getElementById('btn-toggle-closed');

    if (showClosed) {
        section.style.display = 'block';
        renderClosedPortals();
        btn.innerHTML = '&#128274; Скрыть запечатанные (' + portals.filter(p => p.status === 'closed').length + ')';
    } else {
        section.style.display = 'none';
        btn.innerHTML = '&#128274; Показать запечатанные (' + portals.filter(p => p.status === 'closed').length + ')';
    }
}

// ── Data Loading (local) ──────────────────────────
async function loadPortals() {
    renderPortals();
}

async function loadActionLog() {
    renderActionLog();
}

// ── Action Handlers (local) ───────────────────────
async function handleAction(action, portalId) {
    const p = portals.find(x => x.id === portalId);
    if (!p) return;

    const cost = ACTION_COSTS[action];
    if (cost !== undefined && resources < cost) {
        showToast(`Недостаточно ресурсов! Нужно: ${cost}.`, 'error');
        playSound('alarm');
        return;
    }

    switch (action) {
        case 'stabilize': {
            if (p.status === 'closed') {
                showToast('Нельзя стабилизировать закрытый портал.', 'error');
                playSound('alarm');
                return;
            }
            p.stability = Math.min(100, p.stability + 30);
            p.energy_level = Math.max(0, p.energy_level - 10);
            p.time_to_collapse_sec += 20;
            p.status = 'stabilizing';
            const note = `Стабилизация портала «${p.name}»: стабильность +30% → ${p.stability}%, энергия -10% → ${p.energy_level}%, время +20с → ${p.time_to_collapse_sec}с.`;
            p.history.push({ timestamp: getTimestamp(), action: "Стабилизация", note });
            addLog(p.name, "Стабилизация", note);
            resources -= ACTION_COSTS.stabilize;
            playSound('stabilize');
            showToast(`Портал «${p.name}» стабилизирован. (-${ACTION_COSTS.stabilize} ресурсов)`, 'success');
            break;
        }

        case 'close': {
            if (p.status === 'closed') {
                showToast('Портал уже закрыт.', 'error');
                playSound('alarm');
                return;
            }
            if (p.entity_count > 0) {
                const confirmed = await showConfirm(
                    'Подтверждение закрытия',
                    `В портале «${p.name}» находятся ${p.entity_count} существ. Вы уверены, что хотите принудительно закрыть?`
                );
                if (!confirmed) {
                    playSound('click');
                    return;
                }
                p.entity_count = 0;
                const note = `Принудительное закрытие портала «${p.name}». Все существа эвакуированы.`;
                p.history.push({ timestamp: getTimestamp(), action: "Force Close", note });
                addLog(p.name, "Force Close", note);
            } else {
                const note = `Портал «${p.name}» безопасно запечатан.`;
                p.history.push({ timestamp: getTimestamp(), action: "Закрытие", note });
                addLog(p.name, "Закрытие", note);
            }
            resources -= ACTION_COSTS.close;
            p.status = 'closed';
            p.time_to_collapse_sec = 120;
            playSound('close');
            showToast(`Портал «${p.name}» закрыт. (-${ACTION_COSTS.close} ресурсов)`, 'success');
            break;
        }

        case 'evacuate': {
            if (p.entity_count === 0) {
                showToast('В этом портале нет существ для эвакуации.', 'error');
                playSound('alarm');
                return;
            }
            const evacuated = p.entity_count;
            p.entity_count = 0;
            const note = `Эвакуация портала «${p.name}»: выведено ${evacuated} существ.`;
            p.history.push({ timestamp: getTimestamp(), action: "Эвакуация", note });
            addLog(p.name, "Эвакуация", note);
            resources -= ACTION_COSTS.evacuate;
            playSound('evacuate');
            showToast(`${evacuated} существ эвакуировано из «${p.name}». (-${ACTION_COSTS.evacuate} ресурсов)`, 'success');
            break;
        }

        case 'observer': {
            if (p.status === 'closed') {
                showToast('Нельзя отправить наблюдателя в закрытый портал.', 'error');
                playSound('alarm');
                return;
            }
            const risk = calculateRisk(p);
            if (risk.level === 'КРИТИЧЕСКИЙ') {
                showToast('Нельзя отправить наблюдателя в портал с критическим риском.', 'error');
                playSound('alarm');
                return;
            }
            const note = `Развед-дрон отправлен в портал «${p.name}». Сбор данных...`;
            p.history.push({ timestamp: getTimestamp(), action: "Наблюдатель", note });
            addLog(p.name, "Наблюдатель", note);
            resources -= ACTION_COSTS.observer;
            playSound('click');
            showToast(`Наблюдатель отправлен в «${p.name}». (-${ACTION_COSTS.observer} ресурсов)`, 'success');
            break;
        }

        case 'review': {
            if (p.status === 'closed') {
                showToast('Закрытый портал не нуждается в проверке.', 'error');
                playSound('click');
                return;
            }
            p.status = 'under_review';
            const note = `Портал «${p.name}» помечен как «под вопросом». Передан службе безопасности.`;
            p.history.push({ timestamp: getTimestamp(), action: "Под вопросом", note });
            addLog(p.name, "Под вопросом", note);
            resources -= ACTION_COSTS.review;
            playSound('click');
            showToast(`Портал «${p.name}» помечен «под вопросом». (-${ACTION_COSTS.review} ресурсов)`, 'success');
            break;
        }
    }

    renderPortals();
    renderActionLog();
    updateClosedButton();
}

// ── Portal Upgrades ───────────────────────────────
function applyUpgrade(portalId, upgradeType) {
    const p = portals.find(x => x.id === portalId);
    if (!p) return;

    const cost = UPGRADE_COSTS[upgradeType];
    if (resources < cost) {
        showToast(`Недостаточно ресурсов! Нужно: ${cost}.`, 'error');
        playSound('alarm');
        return;
    }

    let note = '';

    switch (upgradeType) {
        case 'stability':
            p.stability = Math.min(100, p.stability + 15);
            note = `Обслуживание: стабильность +15% → ${p.stability}%.`;
            break;
        case 'energy':
            p.energy_level = Math.max(0, p.energy_level - 10);
            note = `Обслуживание: энергия -10% → ${p.energy_level}%.`;
            break;
        case 'time':
            p.time_to_collapse_sec += 15;
            note = `Обслуживание: время +15с → ${p.time_to_collapse_sec}с.`;
            break;
    }

    resources -= cost;
    p.history.push({ timestamp: getTimestamp(), action: "Обслуживание", note });
    addLog(p.name, "Обслуживание", note);
    playSound('stabilize');
    showToast(`Обслуживание применено к «${p.name}». (-${cost} ресурсов)`, 'success');
    renderPortals();
    renderActionLog();
    updateClosedButton();
}

// ── Event Listeners Setup ─────────────────────────
function setupEventListeners() {
    document.getElementById('portals-table').addEventListener('click', (e) => {
        const nameEl = e.target.closest('.portal-name');
        if (nameEl) {
            const id = parseInt(nameEl.dataset.id, 10);
            playSound('click');
            openPortalDetail(id);
            return;
        }

        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            const id = parseInt(actionBtn.dataset.id, 10);
            playSound('click');
            handleAction(action, id);
        }
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        const upgradeBtn = e.target.closest('[data-upgrade]');
        if (upgradeBtn) {
            const upgradeType = upgradeBtn.dataset.upgrade;
            const id = parseInt(upgradeBtn.dataset.id, 10);
            playSound('click');
            applyUpgrade(id, upgradeType);
            return;
        }

        if (e.target.closest('#modal-close')) {
            document.getElementById('modal-overlay').classList.add('hidden');
            activeModalPortalId = null;
            return;
        }

        if (e.target === document.getElementById('modal-overlay')) {
            document.getElementById('modal-overlay').classList.add('hidden');
            activeModalPortalId = null;
        }
    });

    document.getElementById('confirm-yes').addEventListener('click', () => {
        document.getElementById('confirm-overlay').classList.add('hidden');
    });

    document.getElementById('confirm-no').addEventListener('click', () => {
        document.getElementById('confirm-overlay').classList.add('hidden');
    });

    document.getElementById('btn-toggle-auto').addEventListener('click', () => {
        autoTickEnabled = !autoTickEnabled;
        const label = document.getElementById('sim-mode-label');
        const btn = document.getElementById('btn-toggle-auto');
        const indicator = document.getElementById('sim-indicator');

        if (autoTickEnabled) {
            label.textContent = 'Симуляция активна';
            btn.innerHTML = '⏸ Пауза';
            indicator.classList.remove('paused');
            startAutoTick();
        } else {
            label.textContent = 'Симуляция на паузе';
            btn.innerHTML = '▶ Продолжить';
            indicator.classList.add('paused');
            stopAutoTick();
        }
        playSound('click');
    });

    document.getElementById('btn-manual-tick').addEventListener('click', async () => {
        playSound('click');
        await tickSimulation();
    });

    document.getElementById('btn-reset-sim').addEventListener('click', async () => {
        playSound('click');
        const confirmed = await showConfirm('Сброс системы', 'Вы уверены, что хотите сбросить симуляцию? Все данные будут потеряны.');
        if (!confirmed) return;

        portals = [];
        nextPortalId = 1;
        actionLog = [];
        showClosed = false;
        resources = 100;
        stopAutoDiscovery();
        document.getElementById('closed-section').style.display = 'none';
        showToast('Система сброшена. Ожидание первого разлома...', 'success');
        renderPortals();
        renderActionLog();
        updateClosedButton();
        startAutoDiscovery();
    });

    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        const btn = document.getElementById('btn-sound-toggle');
        btn.innerHTML = soundEnabled ? '🔊 Звук вкл.' : '🔇 Звук выкл.';
        if (soundEnabled) {
            playSound('click');
        }
    });

    document.getElementById('btn-toggle-closed').addEventListener('click', () => {
        playSound('click');
        toggleClosedPortals();
    });
}

// ── Auto Tick Timer ───────────────────────────────
function startAutoTick() {
    stopAutoTick();
    autoTickTimer = setInterval(async () => {
        await tickSimulation();
    }, 2000);
}

function stopAutoTick() {
    if (autoTickTimer) {
        clearInterval(autoTickTimer);
        autoTickTimer = null;
    }
}

// ── Initialization ────────────────────────────────
async function init() {
    await loadPortals();
    await loadActionLog();
    setupEventListeners();
    updateResourceUI();
    startAutoTick();
    startAutoDiscovery();
    updateClosedButton();

    setInterval(() => {
        if (activeModalPortalId !== null) {
            openPortalDetail(activeModalPortalId);
        }
    }, 1000);
}

init();
