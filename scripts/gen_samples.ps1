$ErrorActionPreference = "Stop"
$rand = [System.Random]::new(42)

function Get-WeightedIndex($weights, $rnd) {
    $total = 0.0
    foreach ($w in $weights) { $total += $w }
    $r = $rnd.NextDouble() * $total
    $acc = 0.0
    for ($i = 0; $i -lt $weights.Length; $i++) {
        $acc += $weights[$i]
        if ($r -le $acc) { return $i }
    }
    return $weights.Length - 1
}

$items = @(
    @("Latte", 4.75), @("Cappuccino", 4.50), @("Cold Brew", 4.95),
    @("Drip Coffee", 2.95), @("Matcha Latte", 5.25), @("Croissant", 3.75),
    @("Blueberry Muffin", 3.50), @("Avocado Toast", 8.50),
    @("Breakfast Sandwich", 7.25), @("Caesar Salad", 9.50),
    @("Margherita Panini", 8.95), @("Chocolate Chip Cookie", 2.50),
    @("Iced Tea", 3.25), @("Turkey Club", 9.95),
    @("Bagel with Cream Cheese", 4.25)
)
$rareItems = @(@("Decaf Espresso", 3.50), @("Gluten-Free Muffin", 4.25), @("Hot Chocolate", 4.00))
$orderTypes = @("Dine-In", "Takeout", "Delivery")
$orderTypeWeights = @(0.45, 0.40, 0.15)

$hourBuckets = 7..19
$hourWeights = @(6,10,9,5,7,10,9,4,3,3,6,8,6)

function Get-WeightedHour($rnd) {
    $idx = Get-WeightedIndex $hourWeights $rnd
    return $hourBuckets[$idx]
}

function New-OrdersForDay($d, $rnd) {
    $isWeekend = ($d.DayOfWeek -eq 'Saturday') -or ($d.DayOfWeek -eq 'Sunday')
    $base = 45
    if ($isWeekend) { $n = $base + $rnd.Next(15, 31) } else { $n = $base + $rnd.Next(-5, 9) }
    if ($n -lt 10) { $n = 10 }
    $rows = @()
    for ($o = 0; $o -lt $n; $o++) {
        $hour = Get-WeightedHour $rnd
        if ($isWeekend -and $rnd.NextDouble() -lt 0.3 -and $hour -lt 19) { $hour += 1 }
        $minute = $rnd.Next(0, 60)
        $nItemsRoll = $rnd.NextDouble()
        if ($nItemsRoll -lt 0.55) { $nItems = 1 } elseif ($nItemsRoll -lt 0.90) { $nItems = 2 } else { $nItems = 3 }
        $otIdx = Get-WeightedIndex $orderTypeWeights $rnd
        $orderType = $orderTypes[$otIdx]
        for ($k = 0; $k -lt $nItems; $k++) {
            if ($rnd.NextDouble() -lt 0.05) {
                $pick = $rareItems[$rnd.Next(0, $rareItems.Length)]
            } else {
                $pick = $items[$rnd.Next(0, $items.Length)]
            }
            $qty = 1
            if ($rnd.NextDouble() -ge 0.85) { $qty = 2 }
            $rows += [PSCustomObject]@{
                Date = $d; Hour = $hour; Minute = $minute
                Item = $pick[0]; Qty = $qty; Price = [double]$pick[1]; OrderType = $orderType
            }
        }
    }
    return $rows
}

$start = Get-Date -Year 2026 -Month 8 -Day 3 -Hour 0 -Minute 0 -Second 0
$numDays = 37
$dayRows = @{}
for ($i = 0; $i -lt $numDays; $i++) {
    $d = $start.AddDays($i)
    $dayRows[$d.ToString("yyyy-MM-dd")] = New-OrdersForDay $d $rand
}

$root = "C:\Users\bbzha\OneDrive\Documents\BUS-131A\BUS-Idea"

# Sample 1: first 28 days (Aug 3 - Aug 30)
$path1 = Join-Path $root "sample-data.csv"
$lines1 = New-Object System.Collections.Generic.List[string]
$lines1.Add("Date,Time,Item,Quantity,Price,Order Type")
$total1 = 0
for ($i = 0; $i -lt 28; $i++) {
    $d = $start.AddDays($i)
    $key = $d.ToString("yyyy-MM-dd")
    foreach ($r in $dayRows[$key]) {
        $dateStr = $d.ToString("MM/dd/yyyy")
        $timeStr = "{0:D2}:{1:D2}" -f $r.Hour, $r.Minute
        $priceStr = "`$" + $r.Price.ToString("0.00")
        $itemEsc = if ($r.Item -match '[,"]') { '"' + ($r.Item -replace '"','""') + '"' } else { $r.Item }
        $lines1.Add("$dateStr,$timeStr,$itemEsc,$($r.Qty),$priceStr,$($r.OrderType)")
        $total1++
    }
}
[System.IO.File]::WriteAllLines($path1, $lines1)
Write-Host "Wrote $total1 rows to $path1"

# Sample 2: last 5 days of sample1 (Aug26-30, SAME transactions -> dedupe test) + 9 new days (Aug31-Sep8)
$path2 = Join-Path $root "sample-data-2.csv"
$lines2 = New-Object System.Collections.Generic.List[string]
$lines2.Add("Order Date,Order Time,Product,Qty,Total,Channel")
$total2 = 0
for ($i = 23; $i -lt 37; $i++) {
    $d = $start.AddDays($i)
    $key = $d.ToString("yyyy-MM-dd")
    foreach ($r in $dayRows[$key]) {
        $dateStr = $d.ToString("yyyy-MM-dd")
        $timeStr = "{0:D2}:{1:D2}" -f $r.Hour, $r.Minute
        $priceStr = $r.Price.ToString("0.00")
        $itemEsc = if ($r.Item -match '[,"]') { '"' + ($r.Item -replace '"','""') + '"' } else { $r.Item }
        $lines2.Add("$dateStr,$timeStr,$itemEsc,$($r.Qty),$priceStr,$($r.OrderType)")
        $total2++
    }
}
[System.IO.File]::WriteAllLines($path2, $lines2)
Write-Host "Wrote $total2 rows to $path2"
Write-Host "Overlap dates (Aug 26 - Aug 30) should be skipped as duplicates when sample-data-2.csv is merged after sample-data.csv"
