import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/latest/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

export const homeDuration = new Trend('home_duration', true);
export const homeSuccessRate = new Rate('home_success_rate');

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.25'],
    home_duration: ['p(90)<6800']
  },

  stages: [
    { duration: '2m', target: 7 },
    { duration: '1m', target: 10 },
    { duration: '20s', target: 15 },
    { duration: '10s', target: 92 }
  ]
};

export function handleSummary(data) {
  return {
    './src/output/roadmap_test_report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true })
  };
}

export default function () {
  const baseUrl = 'https://publictenderroadmapper-production.up.railway.appapi';
  const loginUrl = `${baseUrl}/Auth/login`;
  const homeUrl = `${baseUrl}/Roadmap/Home?Skip=0&Take=10`;

  const loginPayload = JSON.stringify({
    email: 'admin@admin.com',
    password: 'admin'
  });
  const params = {
    headers: {
      'Content-Type': 'application/json'
    }
  };
  const loginRes = http.post(loginUrl, loginPayload, params);
  const isLoginOk = check(loginRes, {
    'Login efetuado com sucesso': r => r.status === 200,
    'Token recebido': r => r.json('token') !== undefined
  });

  if (!isLoginOk) {
    sleep(1);
    return;
  }

  const token = loginRes.json('token');
  const authParams = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  };

  const start = new Date();
  const res = http.get(homeUrl, authParams);

  homeDuration.add(res.timings.duration);
  homeSuccessRate.add(res.status === 200);

  check(res, {
    'GET Roadmap/Home - Status 200': r => r.status === 200,
    'GET Roadmap/Home - Conteúdo retornado': r =>
      r.json('content') !== undefined
  });

  sleep(1);
}
