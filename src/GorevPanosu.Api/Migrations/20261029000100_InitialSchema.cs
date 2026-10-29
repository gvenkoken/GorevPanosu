using GorevPanosu.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace GorevPanosu.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261029000100_InitialSchema")]
public sealed class InitialSchema : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "People",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                FullName = table.Column<string>(type: "text", nullable: false),
                IsActive = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_People", x => x.Id));
        migrationBuilder.CreateTable(
            name: "Tasks",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                Description = table.Column<string>(type: "text", nullable: true),
                DueDate = table.Column<DateOnly>(type: "date", nullable: true),
                AssigneeId = table.Column<Guid>(type: "uuid", nullable: true),
                Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Tasks", x => x.Id);
                table.ForeignKey("FK_Tasks_People_AssigneeId", x => x.AssigneeId,
                    "People", "Id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex("IX_Tasks_AssigneeId", "Tasks", "AssigneeId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("Tasks");
        migrationBuilder.DropTable("People");
    }

    protected override void BuildTargetModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "8.0.24");
        modelBuilder.Entity("GorevPanosu.Api.Data.Person", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            entity.Property<string>("FullName").IsRequired().HasColumnType("text");
            entity.Property<bool>("IsActive").HasColumnType("boolean");
            entity.HasKey("Id");
            entity.ToTable("People");
        });
        modelBuilder.Entity("GorevPanosu.Api.Data.TaskItem", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            entity.Property<Guid?>("AssigneeId").HasColumnType("uuid");
            entity.Property<DateTime?>("CompletedAt").HasColumnType("timestamp with time zone");
            entity.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
            entity.Property<string>("Description").HasColumnType("text");
            entity.Property<DateOnly?>("DueDate").HasColumnType("date");
            entity.Property<string>("Status").IsRequired().HasMaxLength(16).HasColumnType("character varying(16)");
            entity.Property<string>("Title").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            entity.HasKey("Id");
            entity.HasIndex("AssigneeId");
            entity.ToTable("Tasks");
        });
        modelBuilder.Entity("GorevPanosu.Api.Data.TaskItem", entity =>
        {
            entity.HasOne("GorevPanosu.Api.Data.Person", "Assignee").WithMany()
                .HasForeignKey("AssigneeId").OnDelete(DeleteBehavior.Restrict);
            entity.Navigation("Assignee");
        });
    }
}
