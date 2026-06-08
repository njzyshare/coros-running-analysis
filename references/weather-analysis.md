---
title: "天气与温湿度分析参考"
summary: "天气数据采集、DI 不适指数计算、配速影响量化"
---

# 天气与温湿度分析参考

## 一、天气数据采集

每次分析关键训练（MP跑/长距离/间歇）时，必须采集训练时段的天气数据。

### 采集优先级

```
优先：高驰网页端自带天气（已授权时）
       ├── 精确到训练时间段（手表联网获取）
       ├── 含温度、湿度、天气现象、风速风向
       └── 由 fetchActivityDetail().weather 返回
       ↓
兜底：Open-Meteo Archive API（未授权时）
       ├── 全天均温/均湿（不如网页端精确）
       └── 需从 querySportRecords 提取坐标
```

### 路径A：高驰网页端（优先）

有网页端登录态时，`fetchActivityDetail()` 直接返回：

```json
{
  "weather": {
    "condition": "小雨",
    "temp": 31,
    "humidity": 76,
    "wind": "东风 6"
  },
  "startTime": {
    "raw": "2026年6月4日 晚上 08:21",
    "period": "晚上"
  }
}
```

**优势：**
- 温度/湿度来自手表实际记录的传感器数据，比 API 推测更准
- 精确到训练那个时段，不是全天均值
- 无需 API Key，无需额外 HTTP 请求

**何时不可用：** 网页端未授权 / 登录态过期 / 该训练无 GPS 坐标

### 路径B：Open-Meteo Archive API（兜底）

网页端不可用时，通过坐标查询：

1. **从 `querySportRecords` 提取坐标**：每条记录包含 `Start Coordinates: 纬度, 经度`
2. **用坐标查询 Open-Meteo Archive API**（免费、无需 API Key）：
   ```
   https://archive-api.open-meteo.com/v1/archive?
     latitude={lat}&longitude={lon}&
     start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}&
     hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code&
     timezone=Asia/Shanghai
   ```
3. **WMO 天气代码→中文映射**：
   ```python
   wmo = {0:"晴",1:"晴间多云",2:"多云",3:"阴",
          45:"雾",51:"小毛毛雨",53:"中毛毛雨",61:"小雨",
          63:"中雨",80:"阵雨",81:"中阵雨",95:"雷暴"}
   ```
4. **训练时段取数**：按训练时长估算（30K≈5-9am，20K≈5-8am，10K≈5-7am）
5. **若无坐标**：询问用户训练地点，用城市名拼坐标查询

## 二、不适指数（Discomfort Index）

> 有网页端登录态时，DI 使用 `fetchActivityDetail().weather` 的精确温度+湿度计算，而非全天均值。

### 公式

```
DI = T - 0.55 × (1 - 0.01 × H) × (T - 14.5)
T = 温度(°C), H = 相对湿度(%)
```

### 参考阈值

| DI 范围 | 影响级别 | 典型表现 |
|---------|---------|---------|
| **< 17** | ✅ 最佳区 | 正常发挥，可冲刺Best |
| **17 - 19** | ⚠️ 轻度影响 | 配速惩罚约+5~10s/km |
| **> 19** | 🔴 明显影响 | 配速惩罚可感知 |

### 温度量化影响（粗估）

```
基准: 17°C
  ≤18°C: 基准区
  20°C:  +5s/km
  22°C:  +10s/km
```

### 湿度量化影响（粗估）

```
同温下每+10%RH ≈ +3-5s/km
湿度 60-70% ≈ 最舒适
80-95% ≈ 可感知
```

## 三、关键分析原则：疲劳 > 天气

纯温湿度解释力 < 10%，疲劳累积解释力 > 80%。

**查天气前，先查前3天跑量和睡眠。**
