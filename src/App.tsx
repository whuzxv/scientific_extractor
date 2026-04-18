/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import * as antd from 'antd';
const { 
  Layout, 
  Typography, 
  Upload, 
  Input, 
  Button, 
  Card: AntdCard, 
  Space, 
  Divider, 
  Table, 
  Tag, 
  message, 
  Spin,
  Empty,
  Tabs,
  Tooltip
} = antd;
const Card = AntdCard as any;
import { 
  UploadOutlined, 
  FileTextOutlined, 
  ExperimentOutlined, 
  CodeOutlined,
  SendOutlined,
  ClearOutlined,
  InfoCircleOutlined,
  GlobalOutlined,
  ToolOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import * as mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ExtractionItem {
  raw_mention: string;
  normalized_name: string;
  tech_type: string;
  manufacturer: string;
  manufacturer_source: 'text' | 'inferred';
  model: string;
  origin: string;
  evidence: string;
}

interface AnalysisResult {
  hardware: ExtractionItem[];
  software: ExtractionItem[];
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);

  const extractTextFromFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'txt') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsText(file);
      });
    } else if (extension === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } else if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      return fullText;
    }
    
    throw new Error('Unsupported file format');
  };

  const handleUpload = async (info: any) => {
    // Ant Design Upload triggers onChange for status changes.
    // We handle the file as soon as it's available.
    const fileObj = info.file.originFileObj || info.file;
    
    // Safety check to ensure we have a valid file object with a name
    if (!fileObj || typeof fileObj.name !== 'string') {
      return; 
    }

    try {
      setLoading(true);
      const text = await extractTextFromFile(fileObj as File);
      setInputText(text);
      message.success(`${fileObj.name} 文件解析成功`);
    } catch (error: any) {
      console.error(error);
      message.error(`${fileObj.name} 解析失败: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!inputText.trim()) {
      message.warning('请输入文段或上传文件。');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:9001/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await response.json();
      if (data.success) {
        // Post-processing corrections
        const processedResult = { ...data.result };
        if (processedResult.software) {
          processedResult.software = processedResult.software.map((item: ExtractionItem) => {
            // Fix R language origin error
            if (item.raw_mention === 'R' || item.normalized_name === 'R') {
              if (item.origin === 'AUT') {
                return { ...item, origin: 'NZL' };
              }
            }
            return item;
          });
        }
        setResults(processedResult);
        message.success('提取分析完成！');
      } else {
        throw new Error(data.error || '分析失败');
      }
    } catch (error) {
      console.error(error);
      message.error('提取失败，请检查后端服务连接。');
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setInputText('');
    setResults(null);
  };

  const loadExample = () => {
    const exampleText = "Data were analyzed in R. Images were processed using ImageJ. Sequencing was performed on Illumina NovaSeq 6000.";
    const exampleResults: AnalysisResult = {
      hardware: [
        {
          raw_mention: "Illumina NovaSeq 6000",
          normalized_name: "NovaSeq 6000",
          tech_type: "DNA sequencer",
          manufacturer: "Illumina",
          manufacturer_source: "text",
          model: "NovaSeq 6000",
          origin: "USA",
          evidence: "Sequencing was performed on Illumina NovaSeq 6000."
        }
      ],
      software: [
        {
          raw_mention: "R",
          normalized_name: "R",
          tech_type: "programming language",
          manufacturer: "R Core Team",
          manufacturer_source: "inferred",
          model: "",
          origin: "NZL",
          evidence: "Data were analyzed in R."
        },
        {
          raw_mention: "ImageJ",
          normalized_name: "ImageJ",
          tech_type: "image processing software",
          manufacturer: "NIH",
          manufacturer_source: "inferred",
          model: "",
          origin: "USA",
          evidence: "Images were processed using ImageJ."
        }
      ]
    };
    setInputText(exampleText);
    setResults(exampleResults);
    message.info('已加载示例数据');
  };

  const countryMap: Record<string, string> = {
    'AFG': '阿富汗', 'ALB': '阿尔巴尼亚', 'DZA': '阿尔及利亚', 'AND': '安道尔', 'AGO': '安哥拉', 'ATG': '安提瓜和巴布达', 'ARG': '阿根廷', 'ARM': '亚美尼亚', 'AUS': '澳大利亚', 'AUT': '奥地利', 'AZE': '阿塞拜疆',
    'BHS': '巴哈马', 'BHR': '巴林', 'BGD': '孟加拉国', 'BRB': '巴巴多斯', 'BLR': '白俄罗斯', 'BEL': '比利时', 'BLZ': '伯利兹', 'BEN': '贝宁', 'BTN': '不丹', 'BOL': '玻利维亚', 'BIH': '波黑', 'BWA': '博茨瓦纳', 'BRA': '巴西', 'BRN': '文莱', 'BGR': '保加利亚', 'BFA': '布基纳法索', 'BDI': '布隆迪',
    'KHM': '柬埔寨', 'CMR': '喀麦隆', 'CAN': '加拿大', 'CPV': '佛得角', 'CAF': '中非', 'TCD': '乍得', 'CHL': '智利', 'CHN': '中国', 'COL': '哥伦比亚', 'COM': '科摩罗', 'COG': '刚果（布）', 'COD': '刚果（金）', 'CRI': '哥斯达黎加', 'CIV': '科特迪瓦', 'HRV': '克罗地亚', 'CUB': '古巴', 'CYP': '塞浦路斯', 'CZE': '捷克',
    'DNK': '丹麦', 'DJI': '吉布提', 'DMA': '多米尼克', 'DOM': '多米尼加', 'ECU': '厄瓜多尔', 'EGY': '埃及', 'SLV': '萨尔瓦多', 'GNQ': '赤道几内亚', 'ERI': '厄立特里亚', 'EST': '爱沙尼亚', 'ETH': '埃塞俄比亚',
    'FJI': '斐济', 'FIN': '芬兰', 'FRA': '法国', 'GAB': '加蓬', 'GMB': '冈比亚', 'GEO': '格鲁吉亚', 'DEU': '德国', 'GHA': '加纳', 'GRC': '希腊', 'GRD': '格林纳达', 'GTM': '危地马拉', 'GIN': '几内亚', 'GNB': '几内亚比绍', 'GUY': '圭亚那',
    'HTI': '海地', 'HND': '洪都拉斯', 'HUN': '匈牙利', 'ISL': '冰岛', 'IND': '印度', 'IDN': '印度尼西亚', 'IRN': '伊朗', 'IRQ': '伊拉克', 'IRL': '爱尔兰', 'ISR': '以色列', 'ITA': '意大利',
    'JAM': '牙买加', 'JPN': '日本', 'JOR': '约旦', 'KAZ': '哈萨克斯坦', 'KEN': '肯尼亚', 'KIR': '基里巴斯', 'KOR': '韩国', 'KWT': '科威特', 'KGZ': '吉尔吉斯斯坦', 'LAO': '老挝', 'LVA': '拉脱维亚', 'LBN': '黎巴嫩', 'LSO': '莱索托', 'LBR': '利比里亚', 'LBY': '利比亚', 'LIE': '列支敦士登', 'LTU': '立陶宛', 'LUX': '卢森堡',
    'MKD': '北马其顿', 'MDG': '马达加斯加', 'MWI': '马拉维', 'MYS': '马来西亚', 'MDV': '马尔代夫', 'MLI': '马里', 'MLT': '马耳他', 'MHL': '马绍尔群岛', 'MRT': '毛里塔尼亚', 'MUS': '毛里求斯', 'MEX': '墨西哥', 'FSM': '密克罗尼西亚', 'MDA': '摩尔多瓦', 'MCO': '摩纳哥', 'MNG': '蒙古', 'MNE': '黑山', 'MAR': '摩洛哥', 'MOZ': '莫桑比克', 'MMR': '缅甸',
    'NAM': '纳米比亚', 'NRU': '瑙鲁', 'NPL': '尼泊尔', 'NLD': '荷兰', 'NZL': '新西兰', 'NIC': '尼加拉瓜', 'NER': '尼日尔', 'NGA': '尼日利亚', 'NOR': '挪威', 'OMN': '阿曼', 'PAK': '巴基斯坦', 'PLW': '帕劳', 'PAN': '巴拿马', 'PNG': '巴布亚新几内亚', 'PRY': '巴拉圭', 'PER': '秘鲁', 'PHL': '菲律宾', 'POL': '波兰', 'PRT': '葡萄牙',
    'QAT': '卡塔尔', 'ROU': '罗马尼亚', 'RUS': '俄罗斯', 'RWA': '卢旺达', 'KNA': '圣基茨和尼维斯', 'LCA': '圣卢西亚', 'VCT': '圣文森特和格林纳丁斯', 'WSM': '萨摩亚', 'SMR': '圣马力诺', 'STP': '圣多美和普林西比', 'SAU': '沙特阿拉伯', 'SEN': '塞内加尔', 'SRB': '塞尔维亚', 'SYC': '塞舌尔', 'SLE': '塞拉利昂', 'SGP': '新加坡', 'SVK': '斯洛伐克', 'SVN': '斯洛文尼亚', 'SLB': '所罗门群岛', 'SOM': '索马里', 'ZAF': '南非', 'SSD': '南苏丹', 'ESP': '西班牙', 'LKA': '斯里兰卡', 'SDN': '苏丹', 'SUR': '苏里南', 'SWE': '瑞典', 'CHE': '瑞士', 'SYR': '叙利亚',
    'TJK': '塔吉克斯坦', 'TZA': '坦桑尼亚', 'THA': '泰国', 'TLS': '东帝汶', 'TGO': '多哥', 'TON': '汤加', 'TTO': '特立尼达和多巴哥', 'TUN': '突尼斯', 'TUR': '土耳其', 'TKM': '土库曼斯坦', 'TUV': '图瓦卢', 'UGA': '乌干达', 'UKR': '乌克兰', 'ARE': '阿联酋', 'GBR': '英国', 'USA': '美国', 'URY': '乌拉圭', 'UZB': '乌兹别克斯坦', 'VUT': '瓦努阿图', 'VAT': '梵蒂冈', 'VEN': '委内瑞拉', 'VNM': '越南',
    'YEM': '也门', 'ZMB': '赞比亚', 'ZWE': '津巴布韦', 'TWN': '中国台湾', 'HKG': '中国香港', 'MAC': '中国澳门'
  };

  const columns = [
    {
      title: '设备名称',
      dataIndex: 'raw_mention',
      key: 'raw_mention',
      width: '20%',
      render: (text: string) => <div className="font-semibold">{text}</div>,
    },
    {
      title: '制造商',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      width: '15%',
      render: (text: string) => text || '未知',
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      width: '15%',
      render: (text: string) => text || '-',
    },
    {
      title: '来源国家',
      dataIndex: 'origin',
      key: 'origin',
      width: '10%',
      render: (text: string) => {
        if (!text) return '-';
        const upperText = text.toUpperCase();
        return countryMap[upperText] || text;
      },
    },
    {
      title: '原文证据',
      dataIndex: 'evidence',
      key: 'evidence',
      width: '40%',
      render: (text: string) => (
        <Tooltip title={text}>
          <div className="text-xs text-gray-500 line-clamp-2 italic">
            "{text}"
          </div>
        </Tooltip>
      )
    },
  ];

  return (
    <Layout className="min-h-screen bg-[#f0f2f5]">
      <Header className="bg-white border-b flex items-center justify-between px-8 sticky top-0 z-10 h-[72px] shadow-sm">
        <div className="flex items-center">
          <ExperimentOutlined style={{ fontSize: '28px', color: '#1890ff', marginRight: '16px' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Precision Science Extractor</Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>高精度科研设备与软件元数据提取工具</Text>
          </div>
        </div>
      </Header>

      <Content className="p-6 transition-all duration-300">
        <div className="max-w-[80%] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-5 flex flex-col gap-6 h-full overflow-hidden">
            <Card 
              className="flex-1 flex flex-col shadow-sm"
              styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px' } }}
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#1890ff' }} />
                  <span>原文输入与解析</span>
                </Space>
              }
              extra={
                <Space>
                  <Button type="link" onClick={loadExample} style={{ padding: 0 }}>查看示例</Button>
                  <Upload
                    accept=".txt,.doc,.docx,.pdf"
                    showUploadList={false}
                    onChange={handleUpload}
                    beforeUpload={() => false}
                  >
                    <Button type="dashed" icon={<UploadOutlined />}>上传文档</Button>
                  </Upload>
                </Space>
              }
            >
              <TextArea
                placeholder="请粘贴科研论文、报告文段，或上传 PDF/Word/TXT 文件进行解析..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{ resize: 'none', fontSize: '14px', lineHeight: '1.6' }}
                className="flex-1 border-none focus:ring-0 bg-gray-50/50 rounded-lg p-4"
              />
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex gap-3">
                  <Button 
                    icon={<ClearOutlined />} 
                    onClick={clearAll}
                    disabled={!inputText && !results}
                    className="flex-1"
                  >
                    清空内容
                  </Button>
                  <Button 
                    type="primary" 
                    icon={<SendOutlined />} 
                    onClick={runAnalysis} 
                    loading={loading}
                    className="flex-[2]"
                  >
                    立即开始结构化解析
                  </Button>
                </div>
                <div className="flex justify-between items-center text-gray-400 text-[10px] px-1">
                  <span>字符数: {inputText.length}</span>
                  <span className="flex items-center">
                    <InfoCircleOutlined className="mr-1" />
                    支持 PDF, Word, TXT 自动解析
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7 h-full overflow-hidden">
            <Card 
              className="h-full flex flex-col shadow-sm"
              styles={{ body: { flex: 1, overflow: 'auto', padding: '16px' } }}
              title={
                <Space>
                  <DatabaseOutlined style={{ color: '#52c41a' }} />
                  <span>提取结果</span>
                  {results && (
                    <Tag color="green" style={{ marginLeft: 8 }}>
                      共发现 {results.hardware.length + results.software.length} 项
                    </Tag>
                  )}
                </Space>
              }
            >
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <Spin size="large" />
                  <div className="mt-4 text-gray-500 font-medium anim-pulse">AI 正在深度扫描技术点...</div>
                </div>
              ) : results ? (
                <Tabs defaultActiveKey="1" className="h-full flex flex-col">
                  <Tabs.TabPane 
                    tab={
                      <span>
                        <ToolOutlined />
                        设备硬件 ({results.hardware.length})
                      </span>
                    } 
                    key="1"
                  >
                    <Table 
                      dataSource={results.hardware.map((item, i) => ({ ...item, key: i }))} 
                      columns={columns} 
                      pagination={false}
                      size="small"
                      scroll={{ y: 'calc(100vh - 350px)' }}
                    />
                  </Tabs.TabPane>
                  <Tabs.TabPane 
                    tab={
                      <span>
                        <CodeOutlined />
                        软件/平台 ({results.software.length})
                      </span>
                    } 
                    key="2"
                  >
                    <Table 
                      dataSource={results.software.map((item, i) => ({ ...item, key: i }))} 
                      columns={columns} 
                      pagination={false}
                      size="small"
                      scroll={{ y: 'calc(100vh - 350px)' }}
                    />
                  </Tabs.TabPane>
                </Tabs>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Empty 
                    image={Empty.PRESENTED_IMAGE_SIMPLE} 
                    description={
                      <div className="text-gray-400">
                        等待分析输入文段
                      </div>
                    } 
                  />
                </div>
              )}
            </Card>
          </div>
        </div>
      </Content>

      <Footer className="text-center text-gray-400 py-3 bg-white border-t text-[11px]">
        Precision Science Extractor — 助力科研文献结构化解析
      </Footer>
    </Layout>
  );
}
