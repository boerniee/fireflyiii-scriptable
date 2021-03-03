const token = "paste token here"
const host = "paste host here"
const currency = "EUR"
const chartColor = "16b82c"

class LineChart {
  // LineChart by https://kevinkub.de/

  constructor(width, height, values) {
    this.ctx = new DrawContext();
    this.ctx.size = new Size(width, height);
    this.values = values;
  }
  
  _calculatePath() {
    let maxValue = Math.max(...this.values);
    let minValue = Math.min(...this.values) * 0.25;
    let difference = maxValue - minValue;
    let count = this.values.length;
    let step = this.ctx.size.width / (count - 1);
    let points = this.values.map((current, index, all) => {
        let x = step*index;
        let y = this.ctx.size.height - (current - minValue) / difference * this.ctx.size.height;
        return new Point(x, y);
    });
    return this._getSmoothPath(points);
  }
      
  _getSmoothPath(points) {
    let path = new Path();
    path.move(new Point(0, this.ctx.size.height));
    path.addLine(points[0]);
    for(let i = 0; i < points.length-1; i++) {
      let xAvg = (points[i].x + points[i+1].x) / 2;
      let yAvg = (points[i].y + points[i+1].y) / 2;
      let avg = new Point(xAvg, yAvg);
      let cp1 = new Point((xAvg + points[i].x) / 2, points[i].y);
      let next = new Point(points[i+1].x, points[i+1].y);
      let cp2 = new Point((xAvg + points[i+1].x) / 2, points[i+1].y);
      path.addQuadCurve(avg, cp1);
      path.addQuadCurve(next, cp2);
    }
    path.addLine(new Point(this.ctx.size.width, this.ctx.size.height));
    path.closeSubpath();
    return path;
  }
  
  configure(fn) {
    let path = this._calculatePath();
    if(fn) {
      fn(this.ctx, path);
    } else {
      this.ctx.addPath(path);
      this.ctx.fillPath(path);
    }
    return this.ctx;
  }

}

const BALANCE_KEY = "balance-in-" + currency;
const NET_WORTH_KEY = "net-worth-in-" + currency;
const BILLS_PAID_KEY = "bills-paid-in-" + currency;
const BILLS_UNPAID_KEY = "bills-unpaid-in-" + currency;
const EARNED_IN_KEY = "earned-in-" + currency;
const SPENT_IN_KEY = "spent-in-" + currency;

// const versionUrl = "https://version.firefly-iii.org/index.json"
let widget = new ListWidget();
await createWidget();

if (!config.runsInWidget) {
  await widget.presentSmall();
}

Script.setWidget(widget);
Script.complete();


async function createWidget() {
    widget.setPadding(0,0,0,0);
    
    let balance = await fetchBalance();
    let about = await fetchAbout();
    let rawChartData = await fetchChartData();
    
    let dataWidget = widget.addStack();
    dataWidget.layoutVertically();
    dataWidget.topAlignContent();
    dataWidget.setPadding(10,12,0,10);
    
    let headerStack = dataWidget.addStack();
    let header = headerStack.addText("💵 Firefly III");
    header.font = Font.regularSystemFont(12);
    header.minimumScaleFactor = 0.50;
    headerStack.layoutHorizontally();
    headerStack.addSpacer();
    let versionText = headerStack.addText("v" + about["data"]["version"]);
    versionText.font = Font.regularSystemFont(8);
    
    let balanceRow = dataWidget.addStack();
    let balanceText = balanceRow.addText((BALANCE_KEY in balance ? balance[BALANCE_KEY].value_parsed : "- €"));
    balanceText.font = Font.semiboldSystemFont(18);
  
    let spentRow = dataWidget.addStack();
    let spentText = spentRow.addText("+" +
        (EARNED_IN_KEY in balance ? balance[EARNED_IN_KEY].value_parsed : "/") +
        " | " +
        (SPENT_IN_KEY in balance ? balance[SPENT_IN_KEY].value_parsed : "/"));
    spentText.font = Font.mediumRoundedSystemFont(10);

    dataWidget.addSpacer(12);
    
    let invoices = "🧾 0 €";
    if(BILLS_PAID_KEY in balance) {
      invoices = "🧾 " + balance[BILLS_PAID_KEY].value_parsed;
    }
    if (BILLS_UNPAID_KEY in balance) {
      invoices += " | " + balance[BILLS_UNPAID_KEY].value_parsed;
    } else {
      invoices += " | 0 €";
    }
    let invoiceRow = dataWidget.addStack();
    let invoiceText = invoiceRow.addText(invoices); 
    invoiceText.font = Font.regularSystemFont(12);
     
    let worthText = dataWidget.addStack().addText("🏦 " + (NET_WORTH_KEY in balance ? balance[NET_WORTH_KEY].value_parsed : "- €"));
    worthText.font = Font.regularSystemFont(12);
    
    dataWidget.addSpacer();
    
    let chartData = Object.keys(rawChartData).sort().map(k => rawChartData[k]);
    let chartImage = new LineChart(400,120,chartData).configure((ctx,path) => {  
      ctx.opaque = false;
      ctx.setFillColor(new Color(chartColor, .5));  
      ctx.addPath(path);
      ctx.fillPath(path);
    }).getImage();
    let chartStack = widget.addStack();
    chartStack.setPadding(0,0,0,0);
    let image = chartStack.addImage(chartImage);
    image.applyFittingContentMode();
}

async function fetchChartData() {
  let path = "/api/v1/chart/account/overview?start=" + getFirstDayDate() + "&end=" + getCurrentDay();  
  let data =  await fetchUrl(path);
  chartData = {};
  if (data.length > 0) {
    chartData = data[0].entries;
    if (data.length === 1) return chartData;
    for (let i=1;i<data.length;i++) {
      Object.keys(data[i].entries).forEach(function (elem, idx) {
        chartData[elem] += data[i].entries[elem];
      })
    }
  }
  return chartData;
}

async function fetchBalance() {
    let path = "/api/v1/summary/basic?start=" + getFirstDayDate() + "&end=" + getLastDayDate();
    return fetchUrl(path);
}

async function fetchPiggyBank() {
  let parh = "/api/v1/piggy_banks";
  return fetchUrl(path);
}

async function fetchAbout() {
  let path = "/api/v1/about";
  return fetchUrl(path);
}

async function fetchUrl(url) {
  let req = new Request(host + url);
  req.headers = {"Authorization": "Bearer " + token};
  return await req.loadJSON();
}

function getCurrentDay() {
  let date = new Date();
  return (date.getFullYear() + "-" + 
      ("0" + (date.getMonth() + 1)).slice(-2) + "-" +
      ("0" + (date.getDate() == 1 ? 2 : date.getDate())).slice(-2));
}

function getLastDayDate() {
  let date = new Date();
  let lastDay = new Date(date.getFullYear(), date.getMonth()+1, 0);
  return (lastDay.getFullYear() + "-" +
      ("0" + (lastDay.getMonth() + 1)).slice(-2) + "-" +
      ("0" + lastDay.getDate()).slice(-2));
}

function getFirstDayDate() {
  let date = new Date();
  return (date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-01");
}