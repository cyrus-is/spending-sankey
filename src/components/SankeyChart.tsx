import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey'
import type { SankeyNodeMinimal, SankeyLinkMinimal } from 'd3-sankey'
import type { SankeyData, VendorTotal } from '../lib/sankey'

interface SankeyChartProps {
  data: SankeyData
  /** 0–1 fraction. Sources below this share of total income are merged into "Other Income". */
  mergeThreshold: number
  onMergeThresholdChange: (value: number) => void
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

const WIDTH = 900
const HEIGHT = 500
const MARGIN = { top: 10, right: 160, bottom: 10, left: 160 }

export function SankeyChart({ data, mergeThreshold, onMergeThresholdChange }: SankeyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const innerWidth = WIDTH - MARGIN.left - MARGIN.right
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom

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
        d3.select(this).attr('stroke-opacity', 0.6)
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke-opacity', 0.3)
      })
      .append('title')
      .text((d) => {
        const src = d.source as D3Node
        const tgt = d.target as D3Node
        return `${src.label} → ${tgt.label}\n$${d.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      })

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
      .attr('fill', (d) => d.color)
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
  }, [data])

  if (data.nodes.length === 0) return null

  return (
    <div className="sankey-wrap">
      <div className="sankey-summary">
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
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          style={{ display: 'block' }}
        />
        {tooltip && (
          <div
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
