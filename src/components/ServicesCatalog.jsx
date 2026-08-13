import React from 'react';

export default function ServicesCatalog({
  t,
  isHebrew,
  newServiceName,
  setNewServiceName,
  newServicePrice,
  setNewServicePrice,
  handleAddService,
  services,
  editingServiceId,
  setEditingServiceId,
  editServiceName,
  setEditServiceName,
  editServicePrice,
  setEditServicePrice,
  handleSaveEditedService,
  handleDeleteService,
  sym,
  formatNum
}) {
  return (
    <div style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9' }}>
      <h2 style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '700', margin: 0, marginBottom: '12px' }}>{t.servicesCatalog}</h2>
      
      <form onSubmit={handleAddService} style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexDirection: 'row', flexWrap: 'wrap' }}>
        <input 
          type="text" 
          placeholder={t.serviceName} 
          value={newServiceName} 
          onChange={(e) => setNewServiceName(e.target.value)} 
          required 
          style={{ flex: '2 1 140px', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: '#f8fafc' }} 
        />
        <input 
          type="number" 
          step="0.01" 
          placeholder={t.defaultPrice} 
          value={newServicePrice} 
          onChange={(e) => setNewServicePrice(e.target.value)} 
          required 
          style={{ flex: '1 1 80px', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.8rem', background: '#f8fafc' }} 
        />
        <button type="submit" style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
          {t.addService}
        </button>
      </form>

      <div style={{ overflowX: 'auto' }}>
         <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', minWidth: '320px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '6px' }}>{t.description}</th>
              <th style={{ padding: '6px' }}>{t.defaultPrice}</th>
              <th style={{ padding: '6px' }}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '0.8rem' }}>
                  Your catalog is empty. Add services above.
                </td>
              </tr>
            ) : (
              services.map((svc) => {
                const isEditingThisSvc = editingServiceId === svc.id;
                return (
                  <tr key={svc.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                    <td style={{ padding: '8px 6px', fontWeight: '400', color: '#1e293b' }}>
                      {isEditingThisSvc ? (
                        <input 
                          type="text" 
                          value={editServiceName} 
                          onChange={(e) => setEditServiceName(e.target.value)} 
                          style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', fontSize: '0.8rem' }} 
                        />
                      ) : (
                        svc.name
                      )}
                    </td>
                    <td style={{ padding: '8px 6px', color: '#4f46e5', fontWeight: '400' }}>
                      {isEditingThisSvc ? (
                        <input 
                          type="number" 
                          step="0.01" 
                          value={editServicePrice} 
                          onChange={(e) => setEditServicePrice(e.target.value)} 
                          style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100px', fontSize: '0.8rem' }} 
                        />
                      ) : (
                        `${sym}${formatNum(svc.price)}`
                      )}
                    </td>
                    <td style={{ padding: '8px 6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {isEditingThisSvc ? (
                        <>
                          <button 
                            onClick={() => handleSaveEditedService(svc.id)}
                            style={{ background: '#10b981', color: 'white', border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem' }}
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setEditingServiceId(null)}
                            style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem' }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              setEditingServiceId(svc.id);
                              setEditServiceName(svc.name);
                              setEditServicePrice(svc.price);
                            }}
                            style={{ background: '#e0e7ff', color: '#4f46e5', border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem' }}
                          >
                            Edit
                          </button>
                          <button 
                            title={t.delete}
                            onClick={() => handleDeleteService(svc.id)}
                            style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '400', fontSize: '0.65rem' }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
         </table>
      </div>
    </div>
  );
}