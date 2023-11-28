type Config = {
  datasourceId: string;
  database: string;
  table: string;
};

export default (config: Config) => ({
  dashboard: {
    annotations: {
      list: [
        {
          builtIn: 1,
          datasource: '-- Grafana --',
          enable: true,
          hide: true,
          iconColor: 'rgba(0, 211, 255, 1)',
          name: 'Annotations & Alerts',
          target: {
            limit: 100,
            matchAny: false,
            tags: [],
            type: 'dashboard',
          },
          type: 'dashboard',
        },
      ],
    },
    editable: true,
    fiscalYearStartMonth: 0,
    graphTooltip: 0,
    links: [],
    liveNow: false,
    panels: [
      {
        fieldConfig: {
          defaults: {
            color: {
              mode: 'thresholds',
            },
            mappings: [],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        gridPos: {
          h: 6,
          w: 4,
          x: 0,
          y: 0,
        },
        id: 4,
        options: {
          colorMode: 'value',
          graphMode: 'area',
          justifyMode: 'auto',
          orientation: 'auto',
          reduceOptions: {
            calcs: ['last'],
            fields: '',
            values: false,
          },
          textMode: 'auto',
        },
        pluginVersion: '8.4.7',
        targets: [
          {
            database: config.database,
            datasource: {
              type: 'grafana-timestream-datasource',
              id: config.datasourceId,
            },
            measure: 'RUL',
            rawQuery:
              "SELECT measure_value::double FROM $__database.$__table WHERE measure_name = 'RUL' ORDER BY time DESC LIMIT 1",
            refId: 'A',
            table: config.table,
          },
        ],
        title: 'RUL',
        type: 'stat',
      },
      {
        fieldConfig: {
          defaults: {
            color: {
              mode: 'thresholds',
            },
            mappings: [],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        gridPos: {
          h: 6,
          w: 4,
          x: 4,
          y: 0,
        },
        id: 5,
        options: {
          colorMode: 'value',
          graphMode: 'area',
          justifyMode: 'auto',
          orientation: 'auto',
          reduceOptions: {
            calcs: ['last'],
            fields: '',
            values: false,
          },
          textMode: 'auto',
        },
        pluginVersion: '8.4.7',
        targets: [
          {
            database: config.database,
            datasource: {
              type: 'grafana-timestream-datasource',
              id: config.datasourceId,
            },
            measure: 'RUL',
            rawQuery:
              "SELECT measure_value::double FROM $__database.$__table WHERE measure_name = 'zrmsvelocity' ORDER BY time DESC LIMIT 1",
            refId: 'A',
            table: config.table,
          },
        ],
        title: 'Z-Axis RMS Velocity',
        type: 'stat',
      },
      {
        fieldConfig: {
          defaults: {
            color: {
              mode: 'thresholds',
            },
            mappings: [],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        gridPos: {
          h: 6,
          w: 4,
          x: 8,
          y: 0,
        },
        id: 6,
        options: {
          colorMode: 'value',
          graphMode: 'area',
          justifyMode: 'auto',
          orientation: 'auto',
          reduceOptions: {
            calcs: ['last'],
            fields: '',
            values: false,
          },
          textMode: 'auto',
        },
        pluginVersion: '8.4.7',
        targets: [
          {
            database: config.database,
            datasource: {
              type: 'grafana-timestream-datasource',
              id: config.datasourceId,
            },
            measure: 'RUL',
            rawQuery:
              "SELECT measure_value::double FROM $__database.$__table WHERE measure_name = 'temperature' ORDER BY time DESC LIMIT 1",
            refId: 'A',
            table: config.table,
          },
        ],
        title: 'Temperature',
        type: 'stat',
      },
      {
        fieldConfig: {
          defaults: {
            color: {
              mode: 'thresholds',
            },
            mappings: [],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        gridPos: {
          h: 6,
          w: 4,
          x: 12,
          y: 0,
        },
        id: 7,
        options: {
          colorMode: 'value',
          graphMode: 'area',
          justifyMode: 'auto',
          orientation: 'auto',
          reduceOptions: {
            calcs: ['last'],
            fields: '',
            values: false,
          },
          textMode: 'auto',
        },
        pluginVersion: '8.4.7',
        targets: [
          {
            database: config.database,
            datasource: {
              type: 'grafana-timestream-datasource',
              id: config.datasourceId,
            },
            measure: 'RUL',
            rawQuery:
              "SELECT measure_value::double FROM $__database.$__table WHERE measure_name = 'zpeakacceleration' ORDER BY time DESC LIMIT 1",
            refId: 'A',
            table: config.table,
          },
        ],
        title: 'Z-Axis Peak Acceleration',
        type: 'stat',
      },
      {
        fieldConfig: {
          defaults: {
            color: {
              mode: 'palette-classic',
            },
            custom: {
              axisLabel: '',
              axisPlacement: 'auto',
              barAlignment: 0,
              drawStyle: 'line',
              fillOpacity: 0,
              gradientMode: 'none',
              hideFrom: {
                legend: false,
                tooltip: false,
                viz: false,
              },
              lineInterpolation: 'smooth',
              lineWidth: 1,
              pointSize: 5,
              scaleDistribution: {
                type: 'linear',
              },
              showPoints: 'auto',
              spanNulls: false,
              stacking: {
                group: 'A',
                mode: 'none',
              },
              thresholdsStyle: {
                mode: 'off',
              },
            },
            mappings: [],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        gridPos: {
          h: 9,
          w: 16,
          x: 0,
          y: 6,
        },
        id: 2,
        options: {
          legend: {
            calcs: [],
            displayMode: 'list',
            placement: 'bottom',
          },
          tooltip: {
            mode: 'single',
            sort: 'none',
          },
        },
        pluginVersion: '8.4.7',
        targets: [
          {
            database: config.database,
            datasource: {
              type: 'grafana-timestream-datasource',
              id: config.datasourceId,
            },
            measure: 'temperature',
            rawQuery:
              "SELECT measure_value::double as Rul, time FROM $__database.$__table WHERE measure_name = 'RUL' AND time BETWEEN from_milliseconds(${__from}) AND from_milliseconds(${__to})",
            refId: 'A',
            table: config.table,
          },
        ],
        title: 'RUL',
        type: 'timeseries',
      },
    ],
    refresh: '5s',
    schemaVersion: 35,
    style: 'dark',
    tags: [],
    templating: {
      list: [],
    },
    time: {
      from: 'now-5m',
      to: 'now',
    },
    timepicker: {},
    timezone: '',
    title: 'Main',
    version: 1,
    weekStart: '',
  },
});
