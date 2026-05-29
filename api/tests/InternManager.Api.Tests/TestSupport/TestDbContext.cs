using InternManager.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace InternManager.Api.Tests.TestSupport;

internal static class TestDbContext
{
    public static AppDbContext Create()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new AppDbContext(options);
    }
}
