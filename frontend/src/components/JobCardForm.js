import React from 'react';

export default function JobCardForm(props) {
  return (
    <form onSubmit={props.onSubmit}>
      <select name="vehicle" required>
        <option value="">Select Vehicle</option>
        <option value="23425 WWT">23425 WWT</option>
        <option value="41141 WWT">41141 WWT</option>
        <option value="AIR COMPRESSOR DOODAN 12235">AIR COMPRESSOR DOODAN 12235</option>
        <option value="CAMION 3916 TBP">CAMION 3916 TBP</option>
        <option value="CAMION 3916-T8P">CAMION 3916-T8P</option>
        <option value="CAMION 4125 AH">CAMION 4125 AH</option>
        <option value="CAMION 412AH">CAMION 412AH</option>
        <option value="CAMION 8542 AH">CAMION 8542 AH</option>
        <option value="COMPRESSEUR">COMPRESSEUR</option>
        <option value="CONCRETE MIXER PROJECT">CONCRETE MIXER PROJECT</option>
        <option value="FORKLIFT">FORKLIFT</option>
        <option value="FORKLIFT IMT25">FORKLIFT IMT25</option>
        <option value="FORKLIFT TOYOTA INT8991">FORKLIFT TOYOTA INT8991</option>
        <option value="GROUPE ETECTROGENE">GROUPE ETECTROGENE</option>
        <option value="HYUNDAI BUS 23425 WWT">HYUNDAI BUS 23425 WWT</option>
        <option value="HYUNDAI BUS 4107-AJ">HYUNDAI BUS 4107-AJ</option>
        <option value="LANO CRUISER 5557 AF">LANO CRUISER 5557 AF</option>
        <option value="MIISUBISBHI 8544 AH">MIISUBISBHI 8544 AH</option>
        <option value="MIISUBISHI 5150 AG">MIISUBISHI 5150 AG</option>
        <option value="MITSUBISBHI 8544 AH">MITSUBISBHI 8544 AH</option>
        <option value="STAREX 311215 WWT">STAREX 311215 WWT</option>
        <option value="STAREX 311217 WWT">STAREX 311217 WWT</option>
        <option value="STAREX 4103-AJ">STAREX 4103-AJ</option>
        <option value="STAREX 4108-AJ">STAREX 4108-AJ</option>
        <option value="STAREX 9257 AH">STAREX 9257 AH</option>
        <option value="STAREX JAUNE 8539 AH">STAREX JAUNE 8539 AH</option>
        <option value="TOYOTA HILUX 41141 WWT">TOYOTA HILUX 41141 WWT</option>
        <option value="TOYOTA VIGO 8344 AF">TOYOTA VIGO 8344 AF</option>
      </select>

      <select name="mechanic" required>
        <option value="">Assign Technician</option>
        <option value="MR MAHEFA">MR MAHEFA</option>
        <option value="MR DERA">MR DERA</option>
        <option value="MR EMILE">MR EMILE</option>
        <option value="MR JULIEN">MR JULIEN</option>
        <option value="MR ANTOINE">MR ANTOINE</option>
        <option value="MR ELYSEE">MR ELYSEE</option>
        <option value="MR SOLOFO">MR SOLOFO</option>
        <option value="MR NJAKA">MR NJAKA</option>
        <option value="MR VELOTIANA">MR VELOTIANA</option>
        <option value="MR DIMBY">MR DIMBY</option>
        <option value="MR FRANCK">MR FRANCK</option>
        <option value="MR ROCHIN">MR ROCHIN</option>
        <option value="MR NOMENA">MR NOMENA</option>
        <option value="MR VICTOR">MR VICTOR</option>
        <option value="MR ROMUALD">MR ROMUALD</option>
        <option value="MR CLERISS">MR CLERISS</option>
        <option value="MR JEAN AIME">MR JEAN AIME</option>
        <option value="MR DENIS">MR DENIS</option>
        <option value="MR NIVO">MR NIVO</option>
        <option value="MR MAMITIANA">MR MAMITIANA</option>
      </select>

      <label>Start Date:</label>
      <input type="date" name="startDate" required />

      <label>End Date:</label>
      <input type="date" name="endDate" required />

      <textarea name="description" placeholder="Issue Description" required></textarea>
      <button type="submit">Create Job Card</button>
    </form>
  );
}
