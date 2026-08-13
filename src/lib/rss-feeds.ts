import type { NewsItem } from '../data/types'

export type RssFeedConfig = {
  id: string
  name: string
  url: string
  category: NewsItem['category']
  accent: NewsItem['accent']
  tag: string
  /** 仅保留标题或摘要匹配的教育相关条目 */
  keywords?: RegExp
}

export type NewsPortal = {
  id: string
  name: string
  url: string
  note: string
}

const PEDAGOGY_KEYWORDS =
  /教育|学校|大学|高校|教师|师范|课程|学生|学前|幼儿|小学|教研|教育部|教材|课标|实习|班主任|幼儿园|高等教育|基础教育|职业教育|思政|双减|指南/

/** 教育相关 RSS 源（经服务端代理拉取，规避浏览器 CORS） */
export const RSS_FEEDS: RssFeedConfig[] = [
  {
    id: 'chinanews-edu',
    name: '中国新闻网·教育',
    url: 'https://www.chinanews.com.cn/rss/edu.xml',
    category: '行业观察',
    accent: 'blue',
    tag: '教育动态',
  },
  {
    id: 'sciencenet-gaojiao',
    name: '科学网·人才高教',
    url: 'http://www.sciencenet.cn/xml/news-0.aspx?di=9',
    category: '高校动态',
    accent: 'teal',
    tag: '高等教育',
  },
  {
    id: 'sciencenet-teaching',
    name: '科学网·教学心得',
    url: 'http://www.sciencenet.cn/xml/blog.aspx?di=9',
    category: '教研动态',
    accent: 'amber',
    tag: '教学反思',
  },
  {
    id: 'chinanews-scroll',
    name: '中国新闻网',
    url: 'https://www.chinanews.com.cn/rss/scroll-news.xml',
    category: '政策通知',
    accent: 'slate',
    tag: '教育相关',
    keywords: PEDAGOGY_KEYWORDS,
  },
]

/** 无公开 RSS、但对教育学教师高频的官方入口 */
export const NEWS_PORTALS: NewsPortal[] = [
  { id: 'moe', name: '教育部', url: 'https://www.moe.gov.cn', note: '政策通知' },
  { id: 'jyb', name: '中国教育新闻网', url: 'http://www.jyb.cn', note: '教育报' },
  { id: 'people-edu', name: '人民网·教育', url: 'http://edu.people.com.cn/', note: '教育频道' },
  { id: 'cnsece', name: '学前教育研究会', url: 'https://www.cnsece.com', note: '学前' },
  { id: 'ece-journal', name: '学前教育研究', url: 'https://c.wanfangdata.com.cn/periodical/xqjyyj', note: '核心期刊' },
]
