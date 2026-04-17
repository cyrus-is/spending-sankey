import { useEffect, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey'
import type { SankeyNodeMinimal, SankeyLinkMinimal } from 'd3-sankey'
import type { SankeyData, VendorTotal } from '../lib/sankey'

interface SankeyChartProps {
  data: SankeyData
  /** 0–1 fraction. Sources below this share of total income are merged into "Other Income". */
  mergeThreshold: number
  onMergeThresholdChange: (value: number) => void
  /** SVG width — defaults to 900. Pass 1200 for detailed (4-column) mode. */
  width?: number
  /** SVG height — defaults to 500. Pass 560 for detailed (4-column) mode. */
  height?: number
  /**
   * Optional budget overlay: maps category name (e.g. "Groceries") to monthly budgeted amount.
   * When set, draws dashed ghost rects at the budgeted height on expense category nodes,
   * and applies a red tint to over-budget nodes.
   */
  budgetOverlay?: Record<string, number>
}

// d3-sankey node/link types
interface D3Node extends SankeyNodeMinimal<D3Node, D3Link> {
  id: string
  label: string
  color: string
  value: number
  topVendors?: VendorTotal[]
}

interface TooltipState {
  x: number
  y: number
  label: string
  total: number
  vendors: VendorTotal[]
}

interface D3Link extends SankeyLinkMinimal<D3Node, D3Link> {
  value: number
}

const DEFAULT_WIDTH = 900
const DEFAULT_HEIGHT = 500
const MARGIN = { top: 10, right: 160, bottom: 10, left: 160 }

export function SankeyChart({ data, mergeThreshold, onMergeThresholdChange, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, budgetOverlay }: SankeyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // After tooltip renders, clamp its top so it never overflows the bottom of the wrap
  useEffect(() => {
    if (!tooltip || !tooltipRef.current || !wrapRef.current) return
    const tipRect = tooltipRef.current.getBoundingClientRect()
    const wrapRect = wrapRef.current.getBoundingClientRect()
    const overflowBottom = (tooltip.y + tipRect.height) - wrapRect.height
    if (overflowBottom > 0) {
      setTooltip((prev) => prev && { ...prev, y: prev.y - overflowBottom - 4 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on specific fields to avoid infinite loop (setTooltip inside effect)
  }, [tooltip?.label, tooltip?.x, tooltip?.y])

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return

    const svg = select(svgRef.current)
    svg.selectAll('*').remove()

    const innerWidth = width - MARGIN.left - MARGIN.right
    const innerHeight = height - MARGIN.top - MARGIN.bottom

    const sankeyNodes: D3Node[] = data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      color: n.color,
      value: n.value,
      topVendors: n.topVendors,
    }))

    // Links reference nodes by string ID (nodeId accessor below must match)
    const sankeyLinks: D3Link[] = data.links.map((l) => ({
      source: l.source as unknown as D3Node,
      target: l.target as unknown as D3Node,
      value: l.value,
    }))

    const sankeyLayout = sankey<D3Node, D3Link>()
      .nodeId((d) => d.id)
      .nodeAlign(sankeyLeft)
      .nodeWidth(16)
      .nodePadding(12)
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])

    const { nodes, links } = sankeyLayout({
      nodes: sankeyNodes,
      links: sankeyLinks,
    })

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // Links
    g.append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (d) => {
        const source = d.source as D3Node
        return source.color
      })
      .attr('stroke-width', (d) => Math.max(1, d.width ?? 1))
      .attr('stroke-opacity', 0.3)
      .on('mouseover', function () {
        select(this).attr('stroke-opacity', 0.6)
      })
      .on('mouseout', function () {
        select(this).attr('stroke-opacity', 0.3)
      })
      .append('title')
      .text((d) => {
        const src = d.source as D3Node
        const tgt = d.target as D3Node
        return `${src.label} → ${tgt.label}\n$${d.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      })

    // Budget overlay ghost rects — drawn BEFORE nodes so they appear behind node rects.
    // Use a single global scale derived from the largest expense node (least likely to have
    // been min-clamped by d3-sankey's 1px floor) so all ghost rects are consistent.
    if (budgetOverlay) {
      const expenseNodes = nodes.filter((d) => d.id.startsWith('cat:') && (d.value ?? 0) > 0)
      if (expenseNodes.length > 0) {
        const refNode = expenseNodes.reduce((a, b) => (a.value ?? 0) >= (b.value ?? 0) ? a : b)
        const globalScale = ((refNode.y1 ?? 0) - (refNode.y0 ?? 0)) / (refNode.value ?? 1)

        const overlayGroup = g.append('g').attr('class', 'budget-overlay')
        expenseNodes.forEach((d) => {
          const category = d.id.slice(4)
          const budgeted = budgetOverlay[category]
          if (budgeted === undefined || budgeted <= 0) return

          const ghostHeight = Math.max(1, budgeted * globalScale)
          const nodeWidth = (d.x1 ?? 0) - (d.x0 ?? 0)

          overlayGroup
            .append('rect')
            .attr('x', d.x0 ?? 0)
            .attr('y', d.y0 ?? 0)
            .attr('width', nodeWidth)
            .attr('height', ghostHeight)
            .attr('fill', 'none')
            .attr('stroke', '#e2e8f0')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4,3')
            .attr('rx', 2)
            .attr('opacity', 0.7)
        })
      }
    }

    // Node rectangles
    const nodeGroup = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')

    nodeGroup
      .append('rect')
      .attr('x', (d) => d.x0 ?? 0)
      .attr('y', (d) => d.y0 ?? 0)
      .attr('width', (d) => (d.x1 ?? 0) - (d.x0 ?? 0))
      .attr('height', (d) => Math.max(1, (d.y1 ?? 0) - (d.y0 ?? 0)))
      .attr('fill', (d) => {
        if (d.id === 'cat:non-deductible') return '#4a5568'
        // Red tint if over budget
        if (budgetOverlay && d.id.startsWith('cat:')) {
          const category = d.id.slice(4)
          const budgeted = budgetOverlay[category]
          if (budgeted !== undefined && (d.value ?? 0) > budgeted) return '#c53030'
        }
        return d.color
      })
      .attr('opacity', (d) => d.id === 'cat:non-deductible' ? 0.5 : 1)
      .attr('rx', 2)
      .style('cursor', (d) => (d.topVendors && d.topVendors.length > 0 ? 'pointer' : 'default'))
      .on('mousemove', function (event: MouseEvent, d: D3Node) {
        if (!d.topVendors || d.topVendors.length === 0) return
        const wrap = wrapRef.current
        if (!wrap) return
        const rect = wrap.getBoundingClientRect()
        setTooltip({
          x: event.clientX - rect.left + 12,
          y: event.clientY - rect.top - 8,
          label: d.label,
          total: d.value ?? 0,
          vendors: d.topVendors,
        })
      })
      .on('mouseleave', () => setTooltip(null))

    // Node labels
    nodeGroup
      .append('text')
      .attr('x', (d) => ((d.x0 ?? 0) < innerWidth / 2 ? (d.x1 ?? 0) + 6 : (d.x0 ?? 0) - 6))
      .attr('y', (d) => ((d.y1 ?? 0) + (d.y0 ?? 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => ((d.x0 ?? 0) < innerWidth / 2 ? 'start' : 'end'))
      .attr('font-size', '11px')
      .attr('fill', '#e2e8f0')
      .text((d) => {
        const val = (d.value ?? 0).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        })
        return `${d.label} ${val}`
      })
  }, [data, width, height, budgetOverlay])

  if (data.nodes.length === 0) return null

  return (
    <div className="sankey-wrap">
      <div className="sankey-summary">
        {data.totalDeductible !== undefined ? (
          <>
            <div className="sankey-summary__item sankey-summary__item--income">
              <span className="sankey-summary__label">Total Deductible</span>
              <span className="sankey-summary__value">
                ${data.totalDeductible.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="sankey-summary__item sankey-summary__item--expense">
              <span className="sankey-summary__label">Non-Deductible</span>
              <span className="sankey-summary__value">
                ${(data.totalNonDeductible ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="sankey-summary__item sankey-summary__item--income">
              <span className="sankey-summary__label">Total Income</span>
              <span className="sankey-summary__value">
                ${data.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="sankey-summary__item sankey-summary__item--expense">
              <span className="sankey-summary__label">Total Expenses</span>
              <span className="sankey-summary__value">
                ${data.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div
              className={`sankey-summary__item ${data.totalIncome >= data.totalExpenses ? 'sankey-summary__item--positive' : 'sankey-summary__item--negative'}`}
            >
              <span className="sankey-summary__label">Net</span>
              <span className="sankey-summary__value">
                {data.totalIncome >= data.totalExpenses ? '+' : '-'}$
                {Math.abs(data.totalIncome - data.totalExpenses).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </>
        )}
        <div className="sankey-summary__item sankey-threshold">
          <label htmlFor="merge-threshold" className="sankey-summary__label">
            Merge sources &lt; {Math.round(mergeThreshold * 100)}%
          </label>
          <input
            id="merge-threshold"
            type="range"
            min={0}
            max={10}
            step={1}
            value={Math.round(mergeThreshold * 100)}
            onChange={(e) => onMergeThresholdChange(parseInt(e.target.value) / 100)}
            className="sankey-threshold__slider"
          />
        </div>
      </div>
      <div className="sankey-svg-wrap" ref={wrapRef} style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          style={{ display: 'block' }}
        />
        {tooltip && (
          <div
            ref={tooltipRef}
            className="sankey-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="sankey-tooltip__header">
              <span className="sankey-tooltip__label">{tooltip.label}</span>
              <span className="sankey-tooltip__total">
                ${tooltip.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <ol className="sankey-tooltip__vendors">
              {tooltip.vendors.map((v) => (
                <li key={v.name} className="sankey-tooltip__vendor-row">
                  <span className="sankey-tooltip__vendor-name">{v.name}</span>
                  <span className="sankey-tooltip__vendor-amount">
                    ${v.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
