import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { formatCurrency } from '../utils/formatters';

function Section({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
      {children}
    </div>
  );
}

// Convert API rate items array into keyed object: [{item_key, value}] → {key: value}
function toMap(items) {
  const map = {};
  for (const item of items || []) {
    map[item.item_key] = { ...item.value, label: item.label };
  }
  return map;
}

export default function EstimatorPage() {
  const { user } = useAuth();
  const [rates, setRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [form, setForm] = useState({
    builtUpArea: 1200,
    floors: 2,
    finish: 'standard',
    city: 'bangalore',
  });
  const [results, setResults] = useState(null);

  const canManage = ['pm', 'owner'].includes(user?.role);

  useEffect(() => {
    api.get('/estimator/rates')
      .then(setRates)
      .catch(console.error)
      .finally(() => setRatesLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const calculate = () => {
    if (!rates) return;

    const MATERIAL_RULES = toMap(rates.material);
    const LABOUR_RATES = toMap(rates.labour);
    const CITY_MULTIPLIERS = toMap(rates.city);
    const FINISH_LEVELS = toMap(rates.finish);
    const STEEL_DISTRIBUTION = toMap(rates.steel_distribution);
    const FLOOR_STEEL_RATES = toMap(rates.floor_steel);

    // Cost categories need special handling (rates per finish level)
    const COST_CATEGORIES = (rates.cost_category || []).map((item) => ({
      key: item.item_key,
      label: item.label,
      perSqft: item.value,
    }));

    const area = Number(form.builtUpArea) || 0;
    const floors = Number(form.floors) || 1;
    const finish = FINISH_LEVELS[form.finish];
    const cityMul = CITY_MULTIPLIERS[form.city]?.factor || 1;
    const totalArea = area * floors;
    const steelRate = FLOOR_STEEL_RATES[String(floors)]?.steelPerSqft || 4.0;

    // Material estimates
    const materials = {};
    for (const [key, rule] of Object.entries(MATERIAL_RULES)) {
      const qty = key === 'steel' ? steelRate * totalArea : (rule.qty || 0) * totalArea;
      const cost = qty * (rule.unitPrice || 0);
      materials[key] = {
        ...rule,
        quantity: Math.ceil(qty),
        cost: Math.round(cost),
      };
    }

    const totalMaterialCost = Object.values(materials).reduce((sum, m) => sum + m.cost, 0);

    // Labour cost breakdown
    const totalLabourPerSqft = Object.values(LABOUR_RATES).reduce((s, r) => s + (r.rate || 0), 0);
    const labourBreakdown = {};
    let totalLabourCost = 0;
    for (const [key, rate] of Object.entries(LABOUR_RATES)) {
      const cost = Math.round((rate.rate || 0) * totalArea * cityMul);
      labourBreakdown[key] = { ...rate, cost };
      totalLabourCost += cost;
    }

    // Cost category breakdown
    const costBreakdown = COST_CATEGORIES.map((cat) => {
      const rate = cat.perSqft[form.finish] || 0;
      const cost = Math.round(rate * totalArea * cityMul);
      return { ...cat, rate, cost };
    });
    const totalConstructionCost = costBreakdown.reduce((s, c) => s + c.cost, 0);

    // Steel distribution
    const totalSteel = materials.steel?.quantity || 0;
    const steelBreakdown = Object.entries(STEEL_DISTRIBUTION).map(([key, comp]) => ({
      ...comp,
      key,
      quantity: Math.round(((comp.percent || 0) / 100) * totalSteel),
    }));

    // Summary
    const contingency = Math.round(totalConstructionCost * 0.10);
    const grandTotal = totalConstructionCost + contingency;
    const costPerSqft = totalArea > 0 ? Math.round(grandTotal / totalArea) : 0;

    setResults({
      totalArea,
      floors,
      finish: finish?.label || form.finish,
      city: CITY_MULTIPLIERS[form.city]?.label || form.city,
      cityMul,
      materials,
      totalMaterialCost,
      labourBreakdown,
      totalLabourCost,
      totalLabourPerSqft: Math.round(totalLabourPerSqft * cityMul),
      costBreakdown,
      totalConstructionCost,
      steelBreakdown,
      totalSteel,
      contingency,
      grandTotal,
      costPerSqft,
      materialPercent: grandTotal > 0 ? Math.round((totalMaterialCost / grandTotal) * 100) : 0,
      labourPercent: grandTotal > 0 ? Math.round((totalLabourCost / grandTotal) * 100) : 0,
    });
  };

  // Build dropdown options from API data
  const floorOptions = (rates?.floor_steel || []).map((r) => ({ key: r.item_key, label: r.label }));
  const finishOptions = (rates?.finish || []).map((r) => ({ key: r.item_key, label: r.label, desc: r.value.description }));
  const cityOptions = (rates?.city || []).map((r) => ({ key: r.item_key, label: r.label, factor: r.value.factor }));

  if (ratesLoading) {
    return <div className="text-center py-12 text-slate-500">Loading estimator rates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Construction Estimator</h1>
          <p className="text-sm text-slate-500 mt-1">
            Estimate materials, labour, and total construction cost based on Indian standards (IS codes, SP 62:1997, CPWD rates)
          </p>
        </div>
        {canManage && (
          <Link
            to="/rates-master"
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 border border-slate-200"
          >
            Manage Rates
          </Link>
        )}
      </div>

      {/* Input Form */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Project Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Built-up Area (sq ft per floor)</label>
            <input
              type="number"
              value={form.builtUpArea}
              onChange={(e) => handleChange('builtUpArea', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              min="100"
              step="50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Number of Floors</label>
            <select
              value={form.floors}
              onChange={(e) => handleChange('floors', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {floorOptions.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Finish Level</label>
            <select
              value={form.finish}
              onChange={(e) => handleChange('finish', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {finishOptions.map((f) => (
                <option key={f.key} value={f.key}>{f.label} - {f.desc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <select
              value={form.city}
              onChange={(e) => handleChange('city', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {cityOptions.map((c) => (
                <option key={c.key} value={c.key}>{c.label} ({c.factor > 1 ? '+' : ''}{Math.round((c.factor - 1) * 100)}%)</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={calculate}
          className="mt-5 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
        >
          Calculate Estimate
        </button>
      </div>

      {results && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <SummaryCard label="Total Built-up Area" value={`${results.totalArea.toLocaleString()} sq ft`} sub={`${results.floors} floor(s) x ${form.builtUpArea} sq ft`} color="blue" />
            <SummaryCard label="Estimated Cost" value={formatCurrency(results.grandTotal)} sub={`${formatCurrency(results.costPerSqft)}/sq ft`} color="green" />
            <SummaryCard label="Material Cost" value={formatCurrency(results.totalMaterialCost)} sub={`~${results.materialPercent}% of total`} color="purple" />
            <SummaryCard label="Labour Cost" value={formatCurrency(results.totalLabourCost)} sub={`${formatCurrency(results.totalLabourPerSqft)}/sq ft`} color="orange" />
            <SummaryCard label="Contingency (10%)" value={formatCurrency(results.contingency)} sub="Recommended reserve" color="yellow" />
          </div>

          {/* Material Estimation */}
          <Section title="Material Estimation (Thumb Rules)">
            <p className="text-xs text-slate-400 mb-3">Based on standard RCC framed structure for {results.totalArea.toLocaleString()} sq ft | IS code references included</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-2.5 px-3 text-slate-500 font-medium">Material</th>
                    <th className="text-right py-2.5 px-3 text-slate-500 font-medium">Rate/Unit</th>
                    <th className="text-right py-2.5 px-3 text-slate-500 font-medium">Quantity</th>
                    <th className="text-left py-2.5 px-3 text-slate-500 font-medium">Unit</th>
                    <th className="text-right py-2.5 px-3 text-slate-500 font-medium">Est. Cost</th>
                    <th className="text-left py-2.5 px-3 text-slate-500 font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(results.materials).map(([key, mat]) => (
                    <tr key={key} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-700">{mat.label}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(mat.unitPrice)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-800">{mat.quantity.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-slate-500">{mat.unit}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-800">{formatCurrency(mat.cost)}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{mat.note}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                    <td className="py-2.5 px-3 text-slate-800" colSpan={4}>Total Material Cost</td>
                    <td className="py-2.5 px-3 text-right text-blue-700">{formatCurrency(results.totalMaterialCost)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Steel Distribution */}
            <Section title="Steel Distribution by Component">
              <p className="text-xs text-slate-400 mb-3">Total Steel: {results.totalSteel.toLocaleString()} kg ({(results.totalSteel / 1000).toFixed(1)} tonnes)</p>
              <div className="space-y-3">
                {results.steelBreakdown.map((comp) => (
                  <div key={comp.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700">{comp.label}</span>
                      <span className="text-sm font-medium text-slate-800">{comp.quantity.toLocaleString()} kg ({comp.percent}%)</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${comp.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Labour Rates */}
            <Section title="Labour Cost Breakdown">
              <p className="text-xs text-slate-400 mb-3">
                City: {results.city} (multiplier: {results.cityMul}x) | Total: {formatCurrency(results.totalLabourPerSqft)}/sq ft
              </p>
              <div className="space-y-2">
                {Object.entries(results.labourBreakdown).map(([key, lb]) => (
                  <div key={key} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">{lb.label}</span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{lb.percent}%</span>
                    </div>
                    <span className="text-sm font-medium text-slate-800">{formatCurrency(lb.cost)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 border-t-2 border-slate-300 font-semibold">
                  <span className="text-sm text-slate-800">Total Labour Cost</span>
                  <span className="text-sm text-orange-700">{formatCurrency(results.totalLabourCost)}</span>
                </div>
              </div>
            </Section>
          </div>

          {/* Stage-wise Cost Breakdown */}
          <Section title="Stage-wise Construction Cost Breakdown">
            <p className="text-xs text-slate-400 mb-3">
              Finish: {results.finish} | Location: {results.city} | Area: {results.totalArea.toLocaleString()} sq ft
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-2.5 px-3 text-slate-500 font-medium">Category</th>
                    <th className="text-right py-2.5 px-3 text-slate-500 font-medium">Rate/sq ft</th>
                    <th className="text-right py-2.5 px-3 text-slate-500 font-medium">Estimated Cost</th>
                    <th className="text-left py-2.5 px-3 text-slate-500 font-medium w-1/3">Proportion</th>
                  </tr>
                </thead>
                <tbody>
                  {results.costBreakdown.map((cat) => {
                    const pct = results.totalConstructionCost > 0 ? Math.round((cat.cost / results.totalConstructionCost) * 100) : 0;
                    return (
                      <tr key={cat.key} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium text-slate-700">{cat.label}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(cat.rate)}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-800">{formatCurrency(cat.cost)}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 rounded-full h-2">
                              <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 w-8">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">Subtotal</td>
                    <td></td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-800">{formatCurrency(results.totalConstructionCost)}</td>
                    <td></td>
                  </tr>
                  <tr className="bg-yellow-50">
                    <td className="py-2.5 px-3 font-medium text-yellow-800">+ Contingency (10%)</td>
                    <td></td>
                    <td className="py-2.5 px-3 text-right font-medium text-yellow-800">{formatCurrency(results.contingency)}</td>
                    <td></td>
                  </tr>
                  <tr className="bg-green-50 border-t-2 border-green-300">
                    <td className="py-3 px-3 font-bold text-green-800 text-base">Grand Total</td>
                    <td className="py-3 px-3 text-right font-medium text-green-700">{formatCurrency(results.costPerSqft)}/sq ft</td>
                    <td className="py-3 px-3 text-right font-bold text-green-800 text-base">{formatCurrency(results.grandTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>

          {/* Quick Reference */}
          <Section title="Quick Reference - Thumb Rules">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <RuleCard title="Cement" value="0.4 bags/sq ft" detail="1 bag cement = 0.035 m3 concrete (approx)" ref_code="IS 10262" />
              <RuleCard title="Steel" value="3.5 - 5.5 kg/sq ft" detail="Varies by floors: G=3.5, G+1=4.5, G+2=5.0, G+3=5.5" ref_code="IS 456" />
              <RuleCard title="Bricks" value="8 nos/sq ft" detail="Standard size 230x110x75mm, CM 1:6 mortar" ref_code="IS 1077" />
              <RuleCard title="Sand" value="0.816 cft/sq ft" detail="Zone II fine aggregate preferred" ref_code="IS 383" />
              <RuleCard title="Aggregate" value="0.608 cft/sq ft" detail="20mm crushed angular aggregate" ref_code="IS 383" />
              <RuleCard title="Concrete Grade" value="M20 to M25" detail="M20: 1:1.5:3, M25: 1:1:2 (by volume)" ref_code="IS 456" />
              <RuleCard title="Labour Cost" value="30-40% of total" detail="Metro: 35-40%, Rural: 25-30% of total cost" ref_code="CPWD" />
              <RuleCard title="Water" value="0.2 kL/sq ft" detail="For mixing, curing (min 7 days), and misc" ref_code="IS 456" />
              <RuleCard title="Wastage Factor" value="5-8% materials" detail="Add 5% cement, 3% steel, 8% bricks, 5% sand buffer" ref_code="SP 62" />
            </div>
          </Section>

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-700">
              <strong>Disclaimer:</strong> These estimates are based on standard thumb rules (IS codes, SP 62:1997) and prevailing 2024-25 market rates.
              Actual costs vary based on site conditions, soil type, design complexity, seismic zone, material availability, and market fluctuations.
              Always consult a structural engineer and obtain detailed BOQ for accurate project costing.
              Rates reference: CPWD DSR 2024, HouseYog market surveys, and standard construction practice in India.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, color }) {
  const colors = {
    blue: 'border-blue-500 bg-blue-50',
    green: 'border-green-500 bg-green-50',
    purple: 'border-purple-500 bg-purple-50',
    orange: 'border-orange-500 bg-orange-50',
    yellow: 'border-yellow-500 bg-yellow-50',
    red: 'border-red-500 bg-red-50',
  };
  return (
    <div className={`rounded-xl border-l-4 ${colors[color]} p-4`}>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function RuleCard({ title, value, detail, ref_code }) {
  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">{ref_code}</span>
      </div>
      <p className="text-lg font-bold text-blue-700">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{detail}</p>
    </div>
  );
}
