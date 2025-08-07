import { v4 as uuidv4 } from 'uuid';
import { addDays, subYears, format } from 'date-fns';

export interface Fund {
  fundId: string;
  fundCode: string;
  fundName: string;
  fundType: 'Equity' | 'Bond' | 'Balanced' | 'Money Market' | 'Real Estate';
  inceptionDate: string;
  manager: string;
  totalAssets: number;
  expenseRatio: number;
  category: string;
}

export interface FundPrice {
  priceId: string;
  fundId: string;
  priceDate: string;
  nav: number;
  totalAssets: number;
  sharesOutstanding: number;
  dayChange: number;
  dayChangePercent: number;
}

export interface FundReturn {
  returnId: string;
  fundId: string;
  periodEnd: string;
  return1d: number;
  return1w: number;
  return1m: number;
  return3m: number;
  return6m: number;
  returnYtd: number;
  return1y: number;
  return3y: number;
  return5y: number;
}

const fundTypes = ['Equity', 'Bond', 'Balanced', 'Money Market', 'Real Estate'] as const;
const categories = [
  'Large Cap Growth',
  'Large Cap Value',
  'Mid Cap Blend',
  'Small Cap Growth',
  'International Equity',
  'Emerging Markets',
  'Corporate Bond',
  'Government Bond',
  'High Yield Bond',
  'Short Term Bond',
];

const managers = [
  'BlackRock',
  'Vanguard',
  'Fidelity',
  'State Street',
  'PIMCO',
  'JPMorgan',
  'Goldman Sachs',
  'Morgan Stanley',
  'T. Rowe Price',
  'Franklin Templeton',
];

// Generate mock funds
export const generateFunds = (count: number = 100): Fund[] => {
  const funds: Fund[] = [];
  
  for (let i = 0; i < count; i++) {
    const fundType = fundTypes[Math.floor(Math.random() * fundTypes.length)];
    funds.push({
      fundId: uuidv4(),
      fundCode: `${fundType.substring(0, 2).toUpperCase()}${String(i + 1).padStart(4, '0')}`,
      fundName: `${managers[i % managers.length]} ${categories[i % categories.length]} Fund`,
      fundType,
      inceptionDate: format(
        subYears(new Date(), Math.floor(Math.random() * 20) + 1),
        'yyyy-MM-dd'
      ),
      manager: managers[i % managers.length],
      totalAssets: Math.random() * 10000000000 + 1000000,
      expenseRatio: Math.random() * 2,
      category: categories[i % categories.length],
    });
  }
  
  return funds;
};

// Generate time series price data
export const generatePriceHistory = (
  fund: Fund,
  days: number = 365 * 5
): FundPrice[] => {
  const prices: FundPrice[] = [];
  const endDate = new Date();
  const startDate = subYears(endDate, 5);
  let currentNav = 100 + Math.random() * 50;
  let currentAssets = fund.totalAssets;
  
  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const volatility = fund.fundType === 'Equity' ? 0.02 : 0.005;
    const change = (Math.random() - 0.5) * volatility;
    
    currentNav = currentNav * (1 + change);
    currentAssets = currentAssets * (1 + (Math.random() - 0.5) * 0.01);
    
    prices.push({
      priceId: uuidv4(),
      fundId: fund.fundId,
      priceDate: format(date, 'yyyy-MM-dd'),
      nav: Number(currentNav.toFixed(4)),
      totalAssets: currentAssets,
      sharesOutstanding: currentAssets / currentNav,
      dayChange: Number((currentNav * change).toFixed(4)),
      dayChangePercent: Number((change * 100).toFixed(2)),
    });
  }
  
  return prices;
};

// Generate return data
export const generateReturns = (
  fund: Fund,
  prices: FundPrice[]
): FundReturn[] => {
  const returns: FundReturn[] = [];
  const sortedPrices = [...prices].sort((a, b) => 
    new Date(b.priceDate).getTime() - new Date(a.priceDate).getTime()
  );
  
  // Calculate returns for the last day of each month
  for (let i = 0; i < Math.min(60, sortedPrices.length); i += 30) {
    const currentPrice = sortedPrices[i];
    const price1d = sortedPrices[i + 1] || currentPrice;
    const price1w = sortedPrices[i + 7] || currentPrice;
    const price1m = sortedPrices[i + 30] || currentPrice;
    const price3m = sortedPrices[i + 90] || currentPrice;
    const price6m = sortedPrices[i + 180] || currentPrice;
    const price1y = sortedPrices[i + 365] || currentPrice;
    
    returns.push({
      returnId: uuidv4(),
      fundId: fund.fundId,
      periodEnd: currentPrice.priceDate,
      return1d: Number(((currentPrice.nav / price1d.nav - 1) * 100).toFixed(2)),
      return1w: Number(((currentPrice.nav / price1w.nav - 1) * 100).toFixed(2)),
      return1m: Number(((currentPrice.nav / price1m.nav - 1) * 100).toFixed(2)),
      return3m: Number(((currentPrice.nav / price3m.nav - 1) * 100).toFixed(2)),
      return6m: Number(((currentPrice.nav / price6m.nav - 1) * 100).toFixed(2)),
      returnYtd: Number(((Math.random() - 0.5) * 30).toFixed(2)),
      return1y: Number(((currentPrice.nav / price1y.nav - 1) * 100).toFixed(2)),
      return3y: Number(((Math.random() - 0.5) * 50).toFixed(2)),
      return5y: Number(((Math.random() - 0.5) * 60).toFixed(2)),
    });
  }
  
  return returns;
};

// Create complete mock dataset
class MockFundDatabase {
  private funds: Fund[] = [];
  private prices: Map<string, FundPrice[]> = new Map();
  private returns: Map<string, FundReturn[]> = new Map();
  
  constructor() {
    this.initializeData();
  }
  
  private initializeData() {
    this.funds = generateFunds(100);
    
    // Generate price and return data for each fund
    this.funds.forEach(fund => {
      const priceHistory = generatePriceHistory(fund, 365 * 5);
      const returnHistory = generateReturns(fund, priceHistory);
      
      this.prices.set(fund.fundId, priceHistory);
      this.returns.set(fund.fundId, returnHistory);
    });
  }
  
  getFunds(): Fund[] {
    return this.funds;
  }
  
  getFund(fundId: string): Fund | undefined {
    return this.funds.find(f => f.fundId === fundId);
  }
  
  getPrices(fundId: string, startDate?: string, endDate?: string): FundPrice[] {
    const prices = this.prices.get(fundId) || [];
    
    if (!startDate && !endDate) return prices;
    
    return prices.filter(p => {
      const date = new Date(p.priceDate);
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      return date >= start && date <= end;
    });
  }
  
  getReturns(fundId: string): FundReturn[] {
    return this.returns.get(fundId) || [];
  }
  
  getLatestPrices(): FundPrice[] {
    const latest: FundPrice[] = [];
    this.funds.forEach(fund => {
      const prices = this.prices.get(fund.fundId);
      if (prices && prices.length > 0) {
        latest.push(prices[prices.length - 1]);
      }
    });
    return latest;
  }
}

export const mockDatabase = new MockFundDatabase();