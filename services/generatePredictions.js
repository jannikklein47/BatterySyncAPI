const models = require('../models');
const downsampler = require('downsample-lttb')
const { Op } = require('sequelize');


function sameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

function analyzeSinceLastUnplug(log) {
  if (!log || !log.length || log[0].isPluggedIn) return null

  const now = new Date(log[0].createdAt).getTime()
  let startEntry = null

  // newest entry at index 0
  for (let i = 0; i < log.length - 1; i++) {
    const newer = log[i]
    const older = log[i + 1]

    // detect unplug (charging ended)
    if (older.isPluggedIn === true && newer.isPluggedIn === false) {
      startEntry = newer
      console.log(i)
      break
    }
  }

  // fallback: if never unplugged in log, use newest entry
  if (!startEntry) {
    startEntry = log[log.length - 1]
  }

  const startTime = new Date(startEntry.createdAt).getTime()
  const elapsedMs = now - startTime
  if (elapsedMs <= 0) return null

  const latest = log[0] // newest entry
  const latestBattery = Math.floor(latest.battery * 100)
  const startBattery = Math.floor(startEntry.battery * 100)
  const deltaBattery = latestBattery - startBattery
  const ratePerMs = deltaBattery / elapsedMs

  let predictedZeroAt = null
  if (ratePerMs < 0) {
    const timeToZeroMs = latestBattery / Math.abs(ratePerMs)
    predictedZeroAt = new Date(now + timeToZeroMs)
  }

  return {
    startEntry,
    elapsedMinutes: elapsedMs / 60000,
    avgRatePerHour: ratePerMs * 3600000, // % per hour
    predictedZeroAt,
  }
}

module.exports = async function() {

  console.log("Running generate predictions...")

  const deviceList = await models.Device.findAll()
  const deviceHistory = []

  for (const device of deviceList) {

    // Dein spezifischer Wert
    const targetDeviceId = device.id;

    const result = await models.batteryLogs.findAll({
      where: {
        deviceId: targetDeviceId,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        chargingStatus: { [Op.ne]: null },
        battery: { [Op.ne]: null },
        isPluggedIn: { [Op.ne]: null }
      },
      order: [['createdAt', 'DESC']],
      attributes: ['createdAt', 'chargingStatus', 'battery', 'isPluggedIn'],
      raw: true
    });

    if (result.length < 1) continue;

    let lastEntry = await models.batteryLogs.findOne({
      where: {
        createdAt: {
          [Op.lte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      order: [['createdAt', 'DESC']]
    })

    result.push(lastEntry.dataValues || {
      createdAt: Date.now() - 1000 * 60 * 60 * 24 - 1,
      battery: result[result.length -1].battery,
      chargingStatus: result[result.length -1].chargingStatus,
      isPluggedIn: result[result.length - 1].isPluggedIn
    })

    deviceHistory[device.id] = result;
  }

  await models.sequelize.transaction(async t => {
    for (const device of deviceList) {
      const analysis = analyzeSinceLastUnplug(deviceHistory[device.id])
      if (analysis && analysis.predictedZeroAt) {
        await models.Device.update({predictedZeroAt: analysis.predictedZeroAt}, {where: {id: device.id}})
      }
    }

    console.log("Filled predictions: ", (await models.Device.findAll({raw: true})))

  })
}